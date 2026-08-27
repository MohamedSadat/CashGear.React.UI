import {
  CgFilterEvaluationError, CgFilterFieldRegistry, combineFilters, compileFilterPredicate,
  createFilterValue, decodeFilterNode, mapFilterFieldIds, removeFilterSource, validateFilter,
} from '../../filter';
import type {
  CgFilterEvaluationContext, CgFilterFieldDescriptor, CgFilterNode, CgFilterProblem,
} from '../../filter';
import type { CgGridColumnDescriptor, CgGridFilterCondition, CgGridFilterNode } from './CgGrid.types';
import { isDataColumn } from './columns';

export class CgGridFilterConfigurationError extends Error {
  readonly problems: ReadonlyArray<CgFilterProblem>;
  constructor(message: string, problems: ReadonlyArray<CgFilterProblem> = []) {
    super(message);
    this.name = 'CgGridFilterConfigurationError';
    this.problems = problems;
  }
}

function columnField<TItem>(column: CgGridColumnDescriptor<TItem>): CgFilterFieldDescriptor<TItem> | null {
  if (!isDataColumn(column) || !column.accessor) return null;
  const kind = column.type === 'date' ? (column.dateTime ? 'dateTime' : 'date') : column.type;
  if (kind !== 'text' && kind !== 'number' && kind !== 'boolean' && kind !== 'date' && kind !== 'dateTime') return null;
  return {
    fieldId: column.fieldId, formerFieldIds: column.formerFieldIds, label: column.title ?? column.fieldId,
    kind, accessor: column.accessor, visible: column.visible, enabled: column.filterable !== false,
  };
}

export function gridFilterFields<TItem>(
  columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>,
  supplemental: ReadonlyArray<CgFilterFieldDescriptor<TItem>> = [],
): ReadonlyArray<CgFilterFieldDescriptor<TItem>> {
  const result = new Map<string, CgFilterFieldDescriptor<TItem>>();
  for (const column of columns) { const field = columnField(column); if (field) result.set(field.fieldId, field); }
  for (const field of supplemental) result.set(field.fieldId, field);
  return Object.freeze([...result.values()]);
}

export function gridFilterRegistry<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, supplemental: ReadonlyArray<CgFilterFieldDescriptor<TItem>> = []): CgFilterFieldRegistry<TItem> {
  return new CgFilterFieldRegistry(gridFilterFields(columns, supplemental));
}

export function normalizeGridFilter(node: unknown): CgFilterNode | null {
  try { return decodeFilterNode(node); }
  catch (error) { throw new CgGridFilterConfigurationError(error instanceof Error ? error.message : 'The Grid filter is malformed.'); }
}

export function validateGridFilter<TItem>(
  node: CgGridFilterNode | null,
  columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>,
  supplemental: ReadonlyArray<CgFilterFieldDescriptor<TItem>> = [],
  context?: CgFilterEvaluationContext,
  isAuthorized?: (field: CgFilterFieldDescriptor<TItem>) => boolean,
  scope: 'apply' | 'server' | 'persist' = 'apply',
): { readonly criteria: CgFilterNode | null; readonly problems: ReadonlyArray<CgFilterProblem>; readonly valid: boolean } {
  let criteria: CgFilterNode | null;
  try { criteria = normalizeGridFilter(node); }
  catch (error) {
    return { criteria: null, valid: false, problems: [{ kind: 'unknownNode', message: error instanceof Error ? error.message : 'The Grid filter is malformed.', path: '$', blocksApply: true }] };
  }
  const validation = validateFilter(criteria, gridFilterRegistry(columns, supplemental), { evaluationContext: context, isAuthorized, scope });
  return { criteria, ...validation };
}

export function evaluateGridFilter<TItem>(
  node: CgGridFilterNode | null,
  item: TItem,
  columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>,
  context?: CgFilterEvaluationContext,
  supplemental: ReadonlyArray<CgFilterFieldDescriptor<TItem>> = [],
): boolean {
  const registry = new CgFilterFieldRegistry(gridFilterFields([...columns.values()], supplemental));
  const criteria = normalizeGridFilter(node);
  const validation = validateFilter(criteria, registry, { evaluationContext: context });
  if (!validation.valid) throw new CgGridFilterConfigurationError('The Grid filter is invalid.', validation.problems);
  try { return compileFilterPredicate(criteria, registry, context)(item); }
  catch (error) { if (error instanceof CgFilterEvaluationError) throw new CgGridFilterConfigurationError(error.message); throw error; }
}

export function replaceFilterRowConditions(filter: CgGridFilterNode | null, conditions: ReadonlyArray<CgGridFilterCondition>): CgFilterNode | null {
  const criteria = normalizeGridFilter(filter);
  const owned = conditions.map((condition) => {
    const decoded = normalizeGridFilter({ ...condition, source: 'filterRow' });
    if (!decoded || decoded.kind !== 'condition') throw new CgGridFilterConfigurationError('A Grid filter-row entry must be a scalar condition.');
    return decoded;
  });
  return combineFilters(removeFilterSource(criteria, 'filterRow'), owned);
}

/** Explicit user-authorized pruning helper. Grid state migration never calls it implicitly. */
export function pruneGridFilter(node: CgGridFilterNode | null, knownIds: ReadonlySet<string>): CgFilterNode | null {
  const criteria = normalizeGridFilter(node);
  const visit = (candidate: CgFilterNode): CgFilterNode | null => {
    if (candidate.kind === 'condition') return knownIds.has(candidate.fieldId) ? candidate : null;
    if (candidate.kind === 'aggregate') return knownIds.has(candidate.collectionFieldId) ? candidate : null;
    const children = candidate.children.map(visit).filter((child): child is CgFilterNode => child !== null);
    return children.length ? { ...candidate, children } : null;
  };
  return criteria ? visit(criteria) : null;
}

export function migrateGridFilterFields(node: CgGridFilterNode | null, aliases: ReadonlyMap<string, string>): CgFilterNode | null {
  return mapFilterFieldIds(normalizeGridFilter(node), (fieldId) => aliases.get(fieldId) ?? fieldId);
}

export function gridFilterRowValue(condition: CgGridFilterCondition | undefined): unknown {
  if (!condition) return undefined;
  if (condition.values?.length) {
    const first = condition.values[0];
    if (!first || first.kind === 'null') return undefined;
    if (first.kind === 'boolean') return first.text === 'true';
    return first.text;
  }
  return condition.value;
}

export function createGridFilterRowCondition<TItem>(column: CgGridColumnDescriptor<TItem>, value: string): CgGridFilterCondition | null {
  if (!value.trim()) return null;
  const kind = column.type === 'number' ? 'number' : column.type === 'boolean' ? 'boolean' : column.type === 'date' ? 'date' : 'text';
  return { kind: 'condition', fieldId: column.fieldId, operator: column.type === 'text' ? 'contains' : 'equals', values: [createFilterValue(kind, value)], source: 'filterRow' };
}
