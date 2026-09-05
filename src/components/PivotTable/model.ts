import type { CgPivotArea, CgPivotField, CgPivotFieldFilter, CgPivotLayout, CgPivotLayoutStore, CgPivotLayoutStoreContext, CgPivotLimitDetails, CgPivotQuery, CgPivotResult, CgPivotSummaryType } from './CgPivotTable.types';
import { decimal } from './decimal';
export const CG_PIVOT_LAYOUT_VERSION = 2;
export const pivotAreas: ReadonlyArray<CgPivotArea> = ['row', 'column', 'data', 'filter', 'hidden'];
export const pivotSummaries: ReadonlyArray<CgPivotSummaryType> = ['sum', 'count', 'minimum', 'maximum', 'average', 'distinctCount', 'custom'];
export class CgPivotError extends Error {
    override name = 'CgPivotError';
}
export class CgPivotLimitError extends CgPivotError {
    override name = 'CgPivotLimitError';
    readonly limit: CgPivotLimitDetails;
    constructor(limit: CgPivotLimitDetails) { super(`Pivot ${limit.limitName} limit exceeded (${limit.requested}/${limit.maximum}).`); this.limit = limit; }
}
export function checkLimit(limitName: string, requested: number, maximum: number): void {
    if (!Number.isSafeInteger(maximum) || maximum < 1)
        throw new CgPivotError(`Invalid ${limitName} limit.`);
    if (requested > maximum)
        throw new CgPivotLimitError({ limitName, requested, maximum });
}
export function abort(signal?: AbortSignal): void { signal?.throwIfAborted(); }
export function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
export function validateFields<T>(fields: ReadonlyArray<CgPivotField<T>>, local = false): void {
    const keys = new Set<string>();
    checkLimit('fields', fields.length, 64);
    for (const field of fields) {
        if (!field.key.trim() || keys.has(field.key))
            throw new CgPivotError('Pivot field keys must be nonempty and unique.');
        keys.add(field.key);
        if (!['text', 'number', 'decimal', 'boolean', 'date', 'dateTime', 'instant'].includes(field.valueType))
            throw new CgPivotError('Invalid field value type.');
        if (local && !field.getValue && !field.calculated)
            throw new CgPivotError(`Local field '${field.key}' needs getValue.`);
        if (field.groupInterval && field.groupInterval !== 'none' && !['date', 'dateTime', 'instant'].includes(field.valueType))
            throw new CgPivotError('Date grouping requires a temporal field.');
        if (field.calculated && !field.calculated.key.trim())
            throw new CgPivotError('Calculated measures need a stable key.');
    }
}
export function pivotSchemaSignature<T>(fields: ReadonlyArray<CgPivotField<T>>): string {
    return JSON.stringify(fields.map(f => [f.key, f.valueType, f.groupInterval ?? 'none', f.customAggregateKey ?? f.customAggregate?.key ?? f.calculated?.key, f.allowedAreas ?? pivotAreas]));
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 100000) : []; }
export function normalizePivotFilter(value: unknown): CgPivotFieldFilter | undefined {
    if (!value || typeof value !== 'object')
        return undefined;
    const v = record(value);
    const scalar = (x: unknown): x is string | number | boolean | null => x === null || typeof x === 'string' || typeof x === 'boolean' || typeof x === 'number' && Number.isFinite(x);
    return freeze({ memberSelectionActive: v.memberSelectionActive === true, includedMemberKeys: strings(v.includedMemberKeys), excludedMemberKeys: strings(v.excludedMemberKeys), includedValues: Array.isArray(v.includedValues) ? v.includedValues.filter(scalar) : [], minimum: scalar(v.minimum) ? v.minimum : undefined, maximum: scalar(v.maximum) ? v.maximum : undefined, dateFrom: typeof v.dateFrom === 'string' && v.dateFrom ? v.dateFrom : undefined, dateToExclusive: typeof v.dateToExclusive === 'string' && v.dateToExclusive ? v.dateToExclusive : undefined });
}
export function normalizePivotLayout<T>(fields: ReadonlyArray<CgPivotField<T>>, input?: unknown): CgPivotLayout {
    validateFields(fields);
    const candidate = record(input);
    const source = candidate.version === undefined || candidate.version === 1 || candidate.version === 2 ? candidate : {};
    const rows = source.version !== undefined && source.version !== 1 && source.version !== 2 ? [] : Array.isArray(source.fields) ? source.fields.map(record) : [];
    const states = fields.map((field, index) => {
        const saved = rows.find(s => s.key === field.key) ?? {};
        const area = saved.area ?? field.area ?? 'hidden';
        const allowed = field.calculated ? ['data'] : field.allowedAreas ?? ['row', 'column', 'data', 'filter'];
        const defaultArea = field.area && (field.area === 'hidden' || allowed.includes(field.area)) ? field.area : 'hidden';
        const summary = saved.summaryType ?? field.summaryType ?? (field.calculated ? 'custom' : 'sum');
        const hasCustom = Boolean(field.customAggregateKey ?? field.customAggregate?.key ?? field.calculated?.key);
        if (summary === 'custom' && !hasCustom)
            throw new CgPivotError(`Field '${field.key}' has no registered custom aggregate.`);
        return {
            key: field.key, area: (pivotAreas.includes(area as CgPivotArea) && (area === 'hidden' || allowed.includes(area as Exclude<CgPivotArea, 'hidden'>)) ? area : defaultArea) as CgPivotArea,
            areaIndex: typeof saved.areaIndex === 'number' && Number.isSafeInteger(saved.areaIndex) && saved.areaIndex >= 0 ? saved.areaIndex : field.areaIndex ?? index,
            visible: typeof saved.visible === 'boolean' ? saved.visible : field.visible !== false,
            summaryType: field.calculated ? 'custom' as const : pivotSummaries.includes(summary as CgPivotSummaryType) ? summary as CgPivotSummaryType : field.summaryType ?? 'sum',
            sortOrder: (['none', 'ascending', 'descending'].includes(String(saved.sortOrder)) ? saved.sortOrder : field.sortOrder ?? 'none') as 'none' | 'ascending' | 'descending',
            sortMode: (saved.sortMode === 'summaryValue' || saved.sortMode === 'displayValue' ? saved.sortMode : field.sortMode ?? 'displayValue'),
            sortByMeasureKey: typeof saved.sortByMeasureKey === 'string' ? saved.sortByMeasureKey : field.sortByMeasureKey,
            nullPlacement: (saved.nullPlacement === 'first' || saved.nullPlacement === 'last' ? saved.nullPlacement : field.nullPlacement ?? 'last'),
            filter: normalizePivotFilter(saved.filter ?? field.filter), width: typeof saved.width === 'number' && Number.isFinite(saved.width) && saved.width >= 40 ? saved.width : field.width,
        };
    });
    for (const area of pivotAreas)
        states.filter(s => s.area === area).sort((a, b) => a.areaIndex - b.areaIndex).forEach((s, i) => { s.areaIndex = i; });
    const measures = states.filter(s => s.visible && s.area === 'data').sort((a, b) => a.areaIndex - b.areaIndex);
    for (const s of states)
        if (s.sortMode === 'summaryValue') {
            if (!s.sortByMeasureKey && source.version === 1)
                s.sortByMeasureKey = measures[0]?.key;
            if (!s.sortByMeasureKey)
                s.sortByMeasureKey = measures[0]?.key;
            if (!measures.some(m => m.key === s.sortByMeasureKey)) {
                s.sortMode = 'displayValue';
                s.sortByMeasureKey = undefined;
            }
        }
    return freeze({
        version: 2, schemaSignature: pivotSchemaSignature(fields), fields: states,
        expandedRowPaths: strings(source.expandedRowPaths), expandedColumnPaths: strings(source.expandedColumnPaths), expansionStateInitialized: source.expansionStateInitialized === true,
        showRowGrandTotals: source.showRowGrandTotals !== false, showColumnGrandTotals: source.showColumnGrandTotals !== false,
        rowTotalPlacement: source.rowTotalPlacement === 'near' ? 'near' : 'far', columnTotalPlacement: source.columnTotalPlacement === 'near' ? 'near' : 'far',
    });
}
export function createPivotQuery<T>(fields: ReadonlyArray<CgPivotField<T>>, layout: CgPivotLayout, options: Partial<Pick<CgPivotQuery, 'purpose' | 'maxRows' | 'maxColumns' | 'maxCells' | 'locale' | 'timeZone'>> = {}): CgPivotQuery {
    layout = normalizePivotLayout(fields, layout);
    const query: CgPivotQuery = {
        version: 1, purpose: options.purpose ?? 'view', fields: layout.fields.map(s => {
            const f = fields.find(f => f.key === s.key)!;
            return { key: s.key, area: s.area, areaIndex: s.areaIndex, summaryType: s.summaryType, sortOrder: s.sortOrder, sortMode: s.sortMode, sortByMeasureKey: s.sortByMeasureKey, nullPlacement: s.nullPlacement, filter: normalizePivotFilter(s.filter), valueType: f.valueType, groupInterval: f.groupInterval ?? 'none', customAggregateKey: f.customAggregateKey ?? f.customAggregate?.key ?? f.calculated?.key };
        }).filter(f => layout.fields.find(s => s.key === f.key)?.visible && f.area !== 'hidden'), showRowGrandTotals: layout.showRowGrandTotals, showColumnGrandTotals: layout.showColumnGrandTotals,
        maxRows: options.maxRows ?? 10000, maxColumns: options.maxColumns ?? 2000, maxCells: options.maxCells ?? 2000000, locale: options.locale ?? 'en-US', timeZone: options.timeZone
    };
    checkLimit('rows', 0, query.maxRows);
    checkLimit('columns', 0, query.maxColumns);
    checkLimit('cells', 0, query.maxCells);
    new Intl.Collator(query.locale);
    if (query.timeZone)
        new Intl.DateTimeFormat(query.locale, { timeZone: query.timeZone });
    return freeze(query);
}
function isArray(value: unknown): boolean { return Array.isArray(value); }
export function validatePivotResult(result: CgPivotResult, query: CgPivotQuery): void {
    if (!result || !isArray(result.cells) || !isArray(result.rowHierarchy) || !isArray(result.columnHierarchy) || !Number.isSafeInteger(result.sourceRecordCount) || result.sourceRecordCount < 0)
        throw new CgPivotError('Invalid pivot result.');
    const measures = new Map(query.fields.filter(f => f.area === 'data').map(f => [f.key, f]));
    const axis = (nodes: CgPivotResult['rowHierarchy'], maximum: number, name: string): Set<string> => {
        const fields = query.fields.filter(f => f.area === (name === 'rows' ? 'row' : 'column')).sort((a, b) => a.areaIndex - b.areaIndex);
        const ids = new Set<string>(['']);
        const seen = new Set<object>();
        const stack = nodes.map(n => ({ n, parent: [] as string[] }));
        let count = 0;
        while (stack.length) {
            const { n, parent } = stack.pop()!;
            if (!n || seen.has(n) || ids.has(n.id) || !n.id || !isArray(n.path) || !isArray(n.children) || n.path.length !== parent.length + 1 || n.level !== parent.length || fields[n.level]?.key !== n.fieldKey || typeof n.isSubtotal !== 'boolean' || !validMember(n.member) || !n.path.every(validMember))
                throw new CgPivotError('Invalid pivot hierarchy.');
            const keys = n.path.map(m => m.key);
            const id = keys.map(k => k.replaceAll('%', '%25').replaceAll('\u001f', '%1F')).join('\u001f');
            if (id !== n.id || keys.at(-1) !== n.member.key || !parent.every((p, i) => keys[i] === p))
                throw new CgPivotError('Invalid pivot hierarchy path.');
            seen.add(n);
            ids.add(n.id);
            checkLimit(name, ++count, maximum);
            stack.push(...n.children.map(n => ({ n, parent: keys })));
        }
        return ids;
    };
    const rows = axis(result.rowHierarchy, query.maxRows, 'rows');
    const columns = axis(result.columnHierarchy, query.maxColumns, 'columns');
    checkLimit('cells', result.cells.length, query.maxCells);
    const keys = new Set<string>();
    for (const c of result.cells) {
        const key = JSON.stringify([c.rowPathKey, c.columnPathKey, c.dataFieldKey]);
        if (keys.has(key) || !rows.has(c.rowPathKey) || !columns.has(c.columnPathKey) || !measures.has(c.dataFieldKey) || measures.get(c.dataFieldKey)?.summaryType !== c.summaryType || !Number.isSafeInteger(c.sourceCount) || c.sourceCount < 0 || !validScalar(c.value))
            throw new CgPivotError('Invalid pivot cell.');
        const measure=measures.get(c.dataFieldKey)!;
        if(c.value!==null&&(measure.valueType==='number'||measure.valueType==='decimal'||measure.summaryType==='count'||measure.summaryType==='distinctCount')){
            if(typeof c.value==='boolean')throw new CgPivotError('Invalid numeric pivot cell.');
            decimal(c.value);
        }
        keys.add(key);
    }
}
export function validScalar(value: unknown): boolean { return value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value); }
export function validMember(value: unknown): boolean { const m = record(value); return typeof m.key === 'string' && Boolean(m.key) && typeof m.displayText === 'string' && typeof m.isBlank === 'boolean' && validScalar(m.value); }
export class CgPivotBrowserLayoutStore implements CgPivotLayoutStore {
    private readonly prefix: string;
    constructor(prefix = 'cg-pivot:layout:') { this.prefix = prefix; }
    private key(context: CgPivotLayoutStoreContext): string { return this.prefix + encodeURIComponent(context.layoutKey); }
    load(context: CgPivotLayoutStoreContext, signal: AbortSignal): Promise<unknown> { abort(signal); try {
        return Promise.resolve(typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(this.key(context)) ?? 'null') as unknown);
    }
    catch {
        return Promise.resolve(null);
    } }
    save(context: CgPivotLayoutStoreContext, layout: CgPivotLayout, signal: AbortSignal): Promise<void> { abort(signal); if (typeof localStorage !== 'undefined')
        localStorage.setItem(this.key(context), JSON.stringify(layout)); return Promise.resolve(); }
    delete(context: CgPivotLayoutStoreContext, signal: AbortSignal): Promise<void> { abort(signal); if (typeof localStorage !== 'undefined')
        localStorage.removeItem(this.key(context)); return Promise.resolve(); }
}
