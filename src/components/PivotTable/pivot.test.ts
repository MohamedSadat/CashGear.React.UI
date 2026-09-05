import { describe, expect, it } from 'vitest';
import { CgPivotCalculatedMeasures, CgPivotLimitError, createPivotAggregate, createPivotCalculatedState, createPivotExport, createPivotMember, createPivotQuery, getPivotDistinctValues, getPivotDrillDown, normalizePivotLayout, pivotPathKey, pivotValueKey, processPivotData, validatePivotResult } from './index';
import type { CgPivotField, CgPivotResult, CgPivotSummaryType } from './index';
import { decimal, decimalText, roundDecimal } from './decimal';
import { pivotProjection, formatPivotValue } from './projection';
import { matchesPivotFilters } from './engine';
interface Sale {
    region: string | null;
    product: string;
    month: string;
    revenue: string | null;
    cost: string;
    quantity: number;
}
const sales: Sale[] = [
    { region: 'East', product: 'A', month: '2026-01-01', revenue: '0.1', cost: '0.02', quantity: 1 },
    { region: 'East', product: 'A', month: '2026-02-01', revenue: '0.2', cost: '0.04', quantity: 3 },
    { region: 'West', product: 'B', month: '2026-01-01', revenue: '9.7', cost: '4.94', quantity: 6 },
];
const fields: ReadonlyArray<CgPivotField<Sale>> = [
    { key: 'region', valueType: 'text', area: 'row', getValue: r => r.region },
    { key: 'product', valueType: 'text', area: 'row', getValue: r => r.product },
    { key: 'month', valueType: 'date', area: 'column', groupInterval: 'month', getValue: r => r.month },
    { key: 'revenue', valueType: 'decimal', area: 'data', getValue: r => r.revenue },
    { key: 'price', valueType: 'decimal', area: 'data', calculated: CgPivotCalculatedMeasures.averageUnitPrice<Sale>(r => r.revenue, r => r.quantity) },
];
const layout = normalizePivotLayout(fields);
const query = createPivotQuery(fields, layout);
const total = (result: CgPivotResult, key = 'revenue') => result.cells.find(c => !c.rowPathKey && !c.columnPathKey && c.dataFieldKey === key)?.value;
describe('Pivot decimal and mergeable aggregates', () => {
    it.each([
        ['sum', '10'], ['count', 3], ['minimum', '0.1'], ['maximum', '9.7'], ['average', '3.3333333333333333333333333333'], ['distinctCount', 3],
    ] as const)('%s has matching direct and partitioned totals', (kind, expected) => {
        const all = createPivotAggregate(kind);
        const left = createPivotAggregate(kind);
        const right = createPivotAggregate(kind);
        sales.forEach((r, i) => { all.accumulate(r.revenue); (i ? right : left).accumulate(r.revenue); });
        left.merge(right);
        expect(all.finalizeValue()).toBe(expected);
        expect(left.finalizeValue()).toBe(expected);
    });
    it('uses exact decimal strings and round-half-to-even', () => {
        const sum = createPivotAggregate('sum');
        sum.accumulate('0.1');
        sum.accumulate('0.2');
        expect(sum.finalizeValue()).toBe('0.3');
        expect(decimalText(roundDecimal(decimal('1.245'), 2))).toBe('1.24');
        expect(decimalText(roundDecimal(decimal('-1.255'), 2))).toBe('-1.26');
        expect(() => decimal('79228162514264337593543950336')).toThrow('overflow');
        expect(() => decimal(Number.NaN)).toThrow();
    });
    it('ignores null values, counts non-null text and rejects invalid numeric text', () => {
        const count = createPivotAggregate('count', 'text');
        count.accumulate(null);
        count.accumulate('');
        expect(count.finalizeValue()).toBe(1);
        const sum = createPivotAggregate('sum');
        sum.accumulate(null);
        sum.accumulate(true);
        expect(sum.finalizeValue()).toBeNull();
        expect(() => sum.accumulate('invalid')).toThrow();
    });
    it('merges exact distinct keys and rejects incompatible states', () => {
        const a = createPivotAggregate('distinctCount');
        const b = createPivotAggregate('distinctCount');
        a.accumulate('1.0');
        b.accumulate('1');
        b.accumulate('2');
        a.merge(b);
        expect(a.finalizeValue()).toBe(2);
        expect(() => a.merge(createPivotAggregate('count'))).toThrow('Incompatible');
    });
    it('calculates a ratio of totals, not an average of ratios', () => {
        const definition = CgPivotCalculatedMeasures.averageUnitPrice<Sale>(r => r.revenue, r => r.quantity);
        const a = createPivotCalculatedState(definition);
        const b = createPivotCalculatedState(definition);
        a.accumulate(sales[0]!);
        sales.slice(1).forEach(r => b.accumulate(r));
        a.merge(b);
        expect(a.finalizeValue()).toBe('1');
    });
    it('supports seven business calculated measures and zero denominators', () => {
        const a = (r: Sale) => r.revenue;
        const b = (r: Sale) => r.cost;
        const definitions = [CgPivotCalculatedMeasures.grossMargin(a, b), CgPivotCalculatedMeasures.grossMarginPercentage(a, b), CgPivotCalculatedMeasures.averageUnitPrice(a, b), CgPivotCalculatedMeasures.budgetVariance(a, b), CgPivotCalculatedMeasures.budgetVariancePercentage(a, b), CgPivotCalculatedMeasures.fulfilmentPercentage(a, b), CgPivotCalculatedMeasures.inventoryTurnover(a, b)];
        expect(definitions.map(d => { const state = createPivotCalculatedState(d); sales.forEach(r => state.accumulate(r)); return state.finalizeValue(); })).toEqual(['5', '50', '2', '5', '100', '200', '2']);
        const zero = createPivotCalculatedState(CgPivotCalculatedMeasures.ratio('zero', () => 1, () => 0));
        zero.accumulate(null);
        expect(zero.finalizeValue()).toBeNull();
    });
});
describe('Pivot layout, engine and provider boundaries', () => {
    it('computes each hierarchy prefix, cross-total and independent measure', async () => {
        const result = await processPivotData(sales, fields, query);
        expect(total(result)).toBe('10');
        expect(total(result, 'price')).toBe('1');
        expect(result.rowHierarchy).toHaveLength(2);
        const east = result.rowHierarchy.find(n => n.member.value === 'East')!;
        expect(result.cells.find(c => c.rowPathKey === east.id && !c.columnPathKey && c.dataFieldKey === 'price')?.value).toBe('0.075');
        expect(Object.isFrozen(result.cells)).toBe(true);
        expect(sales[0]?.revenue).toBe('0.1');
    });
    it('groups blank members without confusing typed keys and separator characters', () => {
        expect(createPivotMember(' ', { valueType: 'text', groupInterval: 'none' }).isBlank).toBe(true);
        expect(pivotValueKey('1', 'text')).not.toBe(pivotValueKey(1, 'number'));
        expect(pivotPathKey(['a\u001fb'])).not.toBe(pivotPathKey(['a', 'b']));
    });
    it('groups ISO weeks and quarters, rejects invalid dates, and handles instant time zones', () => {
        expect(createPivotMember('2021-01-01', { valueType: 'date', groupInterval: 'week' }).value).toBe('2020-W53');
        expect(createPivotMember('2026-12-01', { valueType: 'date', groupInterval: 'quarter' }).value).toBe('2026-Q4');
        expect(createPivotMember('2026-01-01T01:00:00Z', { valueType: 'instant', groupInterval: 'day' }, 'en-US', 'America/New_York').value).toBe('2025-12-31');
        expect(() => createPivotMember('2026-02-30', { valueType: 'date', groupInterval: 'day' })).toThrow();
        expect(() => createPivotMember('2026-01-01T01:00:00', { valueType: 'instant', groupInterval: 'day' })).toThrow();
    });
    it('distinguishes explicit empty selection from all and excludes the own distinct filter', async () => {
        const filtered = normalizePivotLayout(fields, { ...layout, fields: layout.fields.map(f => f.key === 'region' ? { ...f, filter: { memberSelectionActive: true, includedMemberKeys: [] } } : f) });
        const q = createPivotQuery(fields, filtered);
        expect((await processPivotData(sales, fields, q)).sourceRecordCount).toBe(0);
        const distinct = await getPivotDistinctValues(sales, fields, { fieldKey: 'region', pivotQuery: q, searchText: '', skip: 0, take: 10 });
        expect(distinct.totalCount).toBe(2);
    });
    it('applies exact inclusive numeric and exclusive date bounds', async () => {
        const filtered = normalizePivotLayout(fields, { ...layout, fields: layout.fields.map(f => f.key === 'revenue' ? { ...f, filter: { minimum: '0.2', maximum: '9.7' } } : f.key === 'month' ? { ...f, filter: { dateFrom: '2026-01-01', dateToExclusive: '2026-02-01' } } : f) });
        expect(total(await processPivotData(sales, fields, createPivotQuery(fields, filtered)))).toBe('9.7');
    });
    it('migrates v1, reconciles fields, enforces restrictions and falls back on future versions', () => {
        const restricted = fields.map(f => ({ ...f, allowedAreas: f.key === 'region' ? ['row'] as const : f.allowedAreas }));
        const migrated = normalizePivotLayout(restricted, { version: 1, fields: [{ key: 'region', area: 'data', sortMode: 'summaryValue' }] });
        expect(migrated.version).toBe(2);
        expect(migrated.fields[0]?.area).toBe('row');
        expect(migrated.fields[0]?.sortByMeasureKey).toBe('revenue');
        expect(normalizePivotLayout(fields, { version: 99, showRowGrandTotals: false })).toEqual(layout);
    });
    it('sorts by the chosen measure and preserves subtotal placement', async () => {
        const l = normalizePivotLayout(fields, { ...layout, rowTotalPlacement: 'near', fields: layout.fields.map(f => f.key === 'region' ? { ...f, sortMode: 'summaryValue', sortOrder: 'descending', sortByMeasureKey: 'revenue' } : f) });
        const result = await processPivotData(sales, fields, createPivotQuery(fields, l));
        expect(result.rowHierarchy[0]?.member.value).toBe('West');
        expect(pivotProjection(result, l, fields).rows[0]?.grand).toBe(true);
    });
    it('rejects unregistered fields, duplicate response cells and forged hierarchy paths', async () => {
        const result = await processPivotData(sales, fields, query);
        expect(() => validatePivotResult({ ...result, cells: [...result.cells, result.cells[0]!] }, query)).toThrow();
        expect(() => validatePivotResult({ ...result, cells: result.cells.map(c=>({...c,value:'invalid numeric response'})) }, query)).toThrow();
        expect(() => validatePivotResult({ ...result, rowHierarchy: result.rowHierarchy.map(n => ({ ...n, fieldKey: 'secret' })) }, query)).toThrow();
        await expect(processPivotData(sales, fields, { ...query, fields: [{ ...query.fields[0]!, key: 'secret' }] })).rejects.toThrow();
    });
    it('fails typed resource limits and honors cancellation', async () => {
        await expect(processPivotData(sales, fields, { ...query, maxRows: 1 })).rejects.toBeInstanceOf(CgPivotLimitError);
        await expect(processPivotData(sales, fields, { ...query, maxCells: 1 })).rejects.toBeInstanceOf(CgPivotLimitError);
        const controller = new AbortController();
        controller.abort();
        await expect(processPivotData(sales, fields, query, controller.signal)).rejects.toThrow();
    });
    it('returns bounded filtered drill-down details for the selected prefix only', async () => {
        const result = await processPivotData(sales, fields, query);
        const east = result.rowHierarchy.find(n => n.member.value === 'East')!;
        const details = await getPivotDrillDown(sales, fields, { pivotQuery: query, skip: 0, take: 1, maximumResultSize: 1, cell: { rowPath: east.path, columnPath: [], dataFieldKey: 'revenue', summaryType: 'sum', aggregatedValue: '0.3', coordinates: { rowIndex: 0, columnIndex: 0 }, activeFilters: [] } });
        expect(details.totalCount).toBe(1);
        expect(details.rows).toHaveLength(1);
        expect(details.rows[0]?.values.region).toBe('East');
    });
    it('rejects an unavailable custom aggregate', () => {
        expect(() => normalizePivotLayout([{ key: 'custom', valueType: 'decimal', area: 'data', summaryType: 'custom' as CgPivotSummaryType }])).toThrow('custom aggregate');
    });
});
describe('Pivot logical exports', () => {
    it('formats currency and canonicalizes instants without losing sub-millisecond precision', () => {
        expect(formatPivotValue('1234.56',{key:'n',valueType:'decimal',cellFormat:'C2',currency:'USD'})).toBe('$1,234.56');
        expect(pivotValueKey('2026-01-01T01:00:00.1234567+01:00','instant')).toBe(pivotValueKey('2026-01-01T00:00:00.1234567Z','instant'));
        expect(pivotValueKey('2026-01-01T00:00:00.1234567Z','instant')).not.toBe(pivotValueKey('2026-01-01T00:00:00.1234568Z','instant'));
        expect(()=>createPivotMember('2026-01-01T24:00:00',{valueType:'dateTime',groupInterval:'day'})).toThrow();
        const fields:ReadonlyArray<CgPivotField<string>>=[{key:'time',area:'filter',valueType:'dateTime',getValue:r=>r,filter:{dateFrom:'2026-01-01T00:00:00.1234567',dateToExclusive:'2026-01-01T00:00:00.1234568'}}];
        const q=createPivotQuery(fields,normalizePivotLayout(fields));
        expect(matchesPivotFilters('2026-01-01T00:00:00.1234567',fields,q)).toBe(true);
        expect(matchesPivotFilters('2026-01-01T00:00:00.1234568',fields,q)).toBe(false);
    });
    it('exports all hierarchy rows despite collapsed state and neutralizes CSV formulas', async () => {
        const data = [...sales, { ...sales[0]!, region: '=DANGEROUS()' }];
        const result = await processPivotData(data, fields, query);
        const collapsed = { ...layout, expansionStateInitialized: true, expandedRowPaths: [] };
        const file = createPivotExport(result, collapsed, fields, 'csv');
        const csv = new TextDecoder().decode(file.bytes);
        expect(file.rowCount).toBeGreaterThan(pivotProjection(result, collapsed, fields).rows.length);
        expect(csv).toContain("'=DANGEROUS()");
        expect(csv).toContain('0.1');
    });
    it('writes a ZIP workbook with merged headers, number formats, outlines and RTL', async () => {
        const result = await processPivotData(sales, fields, query);
        const file = createPivotExport(result, layout, fields, 'xlsx', { rightToLeft: true, fileName: '../sales.xlsx' });
        expect([...file.bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
        const xml = new TextDecoder().decode(file.bytes);
        expect(xml).toContain('xl/worksheets/sheet1.xml');
        expect(xml).toContain('mergeCells');
        expect(xml).toContain('rightToLeft="1"');
        expect(xml).toContain('outlineLevel="1"');
        expect(xml).toContain('<v>0.1</v>');
        expect(file.fileName).not.toContain('/');
    });
    it('preserves decimals beyond Excel precision as text and enforces export limits', async () => {
        const result = await processPivotData([{ ...sales[0]!, revenue: '12345678901234567890.12' }], fields, query);
        expect(new TextDecoder().decode(createPivotExport(result, layout, fields, 'xlsx').bytes)).toContain('>12345678901234567890.12</t>');
        expect(() => createPivotExport(result, layout, fields, 'csv', { maximumCells: 1 })).toThrow(CgPivotLimitError);
        expect(() => createPivotExport({...result,isPartial:true}, layout, fields, 'csv')).toThrow('complete');
    });
});
