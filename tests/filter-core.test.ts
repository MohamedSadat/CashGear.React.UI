import { describe, expect, it } from 'vitest';
import {
  CgFilterCodecError,
  CgFilterEvaluationError,
  CgFilterFieldRegistry,
  CgFilterPersistenceError,
  areFiltersEquivalent,
  buildFilterSchemaSignature,
  captureFilterSavedView,
  combineFilters,
  compileFilterPredicate,
  createFilterEvaluationContext,
  decodeFilterNode,
  deserializeFilterSavedView,
  encodeFilterNode,
  evaluateFilter,
  loadFilterSavedView,
  normalizeFilterNode,
  removeFilterSource,
  resolveFilterPeriod,
  serializeFilterSavedView,
  validateFilter,
  type CgFilterNode,
} from '../src/filter';

interface Row {
  readonly id: number;
  readonly name: string;
  readonly amount: string;
  readonly occurredAt: Date;
  readonly secret: string;
  readonly lines: ReadonlyArray<{ readonly quantity: number; readonly sku: string }>;
}

const fields = new CgFilterFieldRegistry<Row>([
  { fieldId: 'id', label: 'ID', kind: 'number', accessor: (row) => row.id },
  { fieldId: 'name', label: 'Name', kind: 'text', accessor: (row) => row.name, formerFieldIds: ['displayName'] },
  { fieldId: 'amount', label: 'Amount', kind: 'number', accessor: (row) => row.amount },
  { fieldId: 'occurredAt', label: 'Occurred', kind: 'dateTime', accessor: (row) => row.occurredAt },
  { fieldId: 'secret', label: 'Secret', kind: 'text', accessor: (row) => row.secret },
  {
    fieldId: 'lines', label: 'Lines', kind: 'collection', accessor: (row) => row.lines,
    collection: {
      aggregates: ['exists', 'count', 'sum'],
      elementFields: [
        { fieldId: 'quantity', label: 'Quantity', kind: 'number', accessor: (line: Row['lines'][number]) => line.quantity },
        { fieldId: 'sku', label: 'SKU', kind: 'text', accessor: (line: Row['lines'][number]) => line.sku },
      ],
    },
  },
]);

const condition: CgFilterNode = Object.freeze({
  kind: 'condition', fieldId: 'amount', operator: 'between', source: 'builder',
  values: Object.freeze([{ kind: 'number' as const, text: '10.00' }, { kind: 'number' as const, text: '20' }]),
});

describe('Filter Core codecs and compatibility', () => {
  it('uses the pinned Razor wire discriminators, typed envelopes, and numeric ordinals', () => {
    expect(encodeFilterNode(condition)).toEqual({
      $type: 'condition', fieldId: 'amount', operator: 14,
      values: [{ kind: 2, text: '10.00' }, { kind: 2, text: '20' }], source: 2,
    });
    expect(areFiltersEquivalent(decodeFilterNode(encodeFilterNode(condition)), condition)).toBe(true);
  });

  it('reads Razor casing and legacy React scalar operands by shape and emits only canonical values', () => {
    const razor = decodeFilterNode({ $TYPE: 'condition', FieldID: 'name', Operator: 2, Source: 1, Values: [{ Kind: 1, Text: 'gear' }] });
    const legacy = normalizeFilterNode({ kind: 'condition', fieldId: 'amount', operator: 'between', value: 5, secondValue: 9 });
    expect(razor).toEqual({ kind: 'condition', fieldId: 'name', operator: 'contains', source: 'filterRow', values: [{ kind: 'text', text: 'gear' }] });
    expect(legacy).toMatchObject({ values: [{ kind: 'number', text: '5' }, { kind: 'number', text: '9' }] });
    expect(encodeFilterNode(legacy)).not.toHaveProperty('value');
  });

  it('fails closed on malformed nodes, unknown ordinals, and configured limits', () => {
    expect(() => decodeFilterNode({ $type: 'script', source: 'alert(1)' })).toThrow(CgFilterCodecError);
    expect(() => decodeFilterNode({ $type: 'condition', fieldId: 'id', operator: 999, values: [] })).toThrow(/Unknown filter operator/u);
    expect(() => decodeFilterNode({ $type: 'group', operator: 0, children: [{ $type: 'condition', fieldId: 'id', operator: 0, values: [] }] }, { maxDepth: 1, maxNodes: 2, maxConditionsPerGroup: 2, maxValuesPerSet: 2 })).toThrow(/nested/u);
  });
});

describe('Filter Core validation, evaluation, and transforms', () => {
  it('blocks unknown, unauthorized, unregistered, and context-free relative criteria', () => {
    expect(validateFilter({ kind: 'condition', fieldId: 'missing', operator: 'equals', values: [{ kind: 'text', text: 'x' }] }, fields).valid).toBe(false);
    expect(validateFilter({ kind: 'condition', fieldId: 'secret', operator: 'equals', values: [{ kind: 'text', text: 'x' }] }, fields, { isAuthorized: (field) => field.fieldId !== 'secret' }).problems[0]?.kind).toBe('unauthorizedField');
    expect(validateFilter({ kind: 'condition', fieldId: 'occurredAt', operator: 'inPeriod', values: [{ kind: 'relativePeriod', text: 'today' }] }, fields).problems[0]?.kind).toBe('missingDateContext');
    const withoutAccessor = new CgFilterFieldRegistry([{ fieldId: 'name', label: 'Name', kind: 'text' }]);
    expect(() => compileFilterPredicate({ kind: 'condition', fieldId: 'name', operator: 'equals', values: [{ kind: 'text', text: 'x' }] }, withoutAccessor)).toThrow(CgFilterEvaluationError);
  });

  it('uses exact decimal comparison and inclusive calendar days across a DST boundary', () => {
    const context = createFilterEvaluationContext({ timeZone: 'America/New_York', firstDayOfWeek: 1, now: () => new Date('2026-03-08T16:00:00Z') });
    const node: CgFilterNode = {
      kind: 'group', operator: 'and', children: [
        { kind: 'condition', fieldId: 'amount', operator: 'greaterThan', values: [{ kind: 'number', text: '9007199254740992' }] },
        { kind: 'condition', fieldId: 'occurredAt', operator: 'between', values: [{ kind: 'date', text: '2026-03-08' }, { kind: 'date', text: '2026-03-08' }] },
      ],
    };
    const row: Row = { id: 1, name: 'A', amount: '9007199254740993', occurredAt: new Date('2026-03-09T03:30:00Z'), secret: '', lines: [] };
    expect(evaluateFilter(node, row, fields, context)).toBe(true);
    expect(resolveFilterPeriod('today', context)).toEqual({ start: '2026-03-08', endExclusive: '2026-03-09' });
  });

  it('evaluates nested collections and source-aware combination/removal without mutation', () => {
    const caller: CgFilterNode = { kind: 'condition', fieldId: 'name', operator: 'contains', values: [{ kind: 'text', text: 'gear' }], source: 'caller' };
    const aggregate: CgFilterNode = {
      kind: 'aggregate', collectionFieldId: 'lines', aggregate: 'sum', aggregateFieldId: 'quantity', resultOperator: 'greaterThanOrEqual',
      values: [{ kind: 'number', text: '3' }], source: 'builder', nestedCriteria: { kind: 'condition', fieldId: 'sku', operator: 'startsWith', values: [{ kind: 'text', text: 'A' }] },
    };
    const combined = combineFilters(caller, [aggregate]);
    const row: Row = { id: 1, name: 'CashGear', amount: '1', occurredAt: new Date(), secret: '', lines: [{ quantity: 1, sku: 'A1' }, { quantity: 2, sku: 'A2' }] };
    expect(validateFilter(combined, fields).valid).toBe(true);
    expect(evaluateFilter(combined, row, fields)).toBe(true);
    expect(removeFilterSource(combined, 'builder')).toEqual(caller);
    expect(combined).not.toBe(caller);
  });
});

describe('Filter Core saved views', () => {
  it('captures wire-safe views and migrates former field IDs with schema diagnostics', () => {
    const originalFields = new CgFilterFieldRegistry<Row>([{ fieldId: 'displayName', label: 'Name', kind: 'text', accessor: (row) => row.name }]);
    const original = captureFilterSavedView({ filterKey: 'orders', name: 'Mine', criteria: { kind: 'condition', fieldId: 'displayName', operator: 'startsWith', values: [{ kind: 'text', text: 'C' }] } }, originalFields);
    const serialized = serializeFilterSavedView(original);
    expect(serialized).toContain('"$type":"condition"');
    const loaded = loadFilterSavedView(deserializeFilterSavedView(serialized), fields);
    expect(loaded.succeeded).toBe(true);
    expect(loaded.schemaChanged).toBe(true);
    expect(loaded.criteria).toMatchObject({ fieldId: 'name' });
    expect(buildFilterSchemaSignature(fields.all)).toContain('name:text');
  });

  it('does not save invalid criteria or deserialize executable-looking payloads', () => {
    expect(() => captureFilterSavedView({ filterKey: 'orders', name: 'Bad', criteria: { kind: 'condition', fieldId: 'missing', operator: 'equals', values: [{ kind: 'text', text: 'x' }] } }, fields)).toThrow(CgFilterPersistenceError);
    expect(() => deserializeFilterSavedView(JSON.stringify({ version: 1, filterKey: 'orders', name: 'Bad', scope: 'personal', schemaSignature: '', criteria: { $type: 'condition', fieldId: 'name', operator: '() => true' } }))).toThrow(CgFilterPersistenceError);
  });
});
