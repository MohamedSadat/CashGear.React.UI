import type { CgPivotAxisNode, CgPivotCell, CgPivotDistinctValuesQuery, CgPivotDistinctValuesResult, CgPivotDrillDownQuery, CgPivotDrillDownResult, CgPivotField, CgPivotMemberValue, CgPivotQuery, CgPivotQueryField, CgPivotResult, CgPivotValue } from './CgPivotTable.types';
import { compareValues, fieldAggregate, pivotPathKey, pivotValueKey } from './aggregates';
import type { CalculatedState } from './aggregates';
import { abort, CgPivotError, checkLimit, freeze, validateFields, validatePivotResult } from './model';
import { temporalKey } from './temporal';
export const cellKey = (row: string, column: string, measure: string): string => JSON.stringify([row, column, measure]);
const pathKey = (members: ReadonlyArray<CgPivotMemberValue>) => pivotPathKey(members.map(m => m.key));
export const axisFields = (query: CgPivotQuery, area: 'row' | 'column' | 'data') => query.fields.filter(f => f.area === area).sort((a, b) => a.areaIndex - b.areaIndex);
function civil(value: string, type: string, timeZone?: string): string {
    value=temporalKey(value,type as 'date'|'dateTime'|'instant');
    if (type === 'date' && !/^\d{4}-\d\d-\d\d$/.test(value) || type === 'dateTime' && !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,7})?)?$/.test(value) || type === 'instant' && !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value))
        throw new CgPivotError('Invalid canonical temporal type.');
    if (!/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d(?:\.\d{1,7})?)?(?:Z|[+-]\d\d:\d\d)?)?$/.test(value))
        throw new CgPivotError('Invalid canonical pivot date.');
    const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : type === 'instant' ? value : `${value.replace(/Z$/, '')}Z`);
    if (!Number.isFinite(parsed.getTime()) || Number(value.slice(0, 4)) < 1)
        throw new CgPivotError('Invalid pivot date.');
    if (type === 'instant' && timeZone) {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(parsed);
        const p = (k: string) => parts.find(p => p.type === k)?.value ?? '';
        return `${p('year').padStart(4, '0')}-${p('month')}-${p('day')}T${p('hour')}:00:00`;
    }
    return type === 'instant' ? parsed.toISOString() : value;
}
export function createPivotMember(value: CgPivotValue, field: Pick<CgPivotQueryField, 'valueType' | 'groupInterval'>, locale = 'en-US', timeZone?: string, blank = '(Blank)'): CgPivotMemberValue {
    if (value === null || typeof value === 'string' && !value.trim())
        return { key: 'null:', value: null, displayText: blank, isBlank: true };
    let grouped: CgPivotValue = value;
    let display = String(value);
    let type = field.valueType;
    if (['date', 'dateTime', 'instant'].includes(type)) {
        if (typeof value !== 'string')
            throw new CgPivotError('Temporal values must be canonical strings.');
        const date = civil(value, type, timeZone);
        const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
        const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
        if (day.getUTCFullYear() !== y || day.getUTCMonth() + 1 !== m || day.getUTCDate() !== d)
            throw new CgPivotError('Invalid pivot civil date.');
        switch (field.groupInterval) {
            case 'year':
                grouped = y;
                display = new Intl.NumberFormat(locale, { useGrouping: false }).format(y);
                type = 'number';
                break;
            case 'quarter':
                grouped = `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
                display = `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
                type = 'text';
                break;
            case 'month':
                grouped = `${date.slice(0, 7)}-01`;
                display = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(day);
                type = 'date';
                break;
            case 'week': {
                const thursday = new Date(day);
                thursday.setUTCDate(d + 4 - (day.getUTCDay() || 7));
                const year = thursday.getUTCFullYear();
                const jan = new Date(`${String(year).padStart(4, '0')}-01-01T00:00:00Z`);
                const week = Math.ceil(((thursday.getTime() - jan.getTime()) / 86400000 + 1) / 7);
                grouped = `${year}-W${String(week).padStart(2, '0')}`;
                display = `W${String(week).padStart(2, '0')} ${year}`;
                type = 'text';
                break;
            }
            case 'day':
                grouped = date.slice(0, 10);
                display = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(day);
                type = 'date';
                break;
            case 'hour':
                grouped = `${date.slice(0, 10)}T${date.slice(11, 13) || '00'}:00:00`;
                display = grouped;
                type = 'dateTime';
                break;
            default: display = value;
        }
    }
    else if (field.groupInterval !== 'none')
        throw new CgPivotError('Non-temporal grouped field.');
    return { key: pivotValueKey(grouped, type), value: grouped, displayText: display, isBlank: false };
}
export function matchesPivotFilters<T>(item: T, fields: ReadonlyArray<CgPivotField<T>>, query: CgPivotQuery, excludeKey?: string): boolean {
    for (const q of query.fields) {
        const f = q.filter;
        if (!f || q.key === excludeKey)
            continue;
        const definition = fields.find(f => f.key === q.key);
        if (!definition?.getValue)
            continue;
        const raw = definition.getValue(item);
        const member = createPivotMember(raw, q, query.locale, query.timeZone);
        if (f.excludedMemberKeys?.includes(member.key))
            return false;
        if ((f.memberSelectionActive || f.includedMemberKeys?.length) && !f.includedMemberKeys?.includes(member.key))
            return false;
        if (f.includedValues?.length && !f.includedValues.some(v => compareValues(raw, v, q.valueType, query.locale) === 0))
            return false;
        if (f.minimum !== undefined && f.minimum !== null && (raw === null || compareValues(raw, f.minimum, q.valueType, query.locale) < 0))
            return false;
        if (f.maximum !== undefined && f.maximum !== null && (raw === null || compareValues(raw, f.maximum, q.valueType, query.locale) > 0))
            return false;
        if (f.dateFrom || f.dateToExclusive) {
            if (typeof raw !== 'string')
                return false;
            if(q.valueType!=='date'&&q.valueType!=='dateTime'&&q.valueType!=='instant')throw new CgPivotError('Date ranges require a temporal field.');
            const type=q.valueType;
            const stamp=temporalKey(raw,type);
            const bound=(value:string)=>{
                const civil=value.length===10&&type!=='date'?`${value}T00:00:00`:value;
                return temporalKey(type==='instant'&&!/(Z|[+-]\d\d:\d\d)$/.test(civil)?civil+'Z':civil,type);
            };
            if (f.dateFrom && stamp < bound(f.dateFrom))
                return false;
            if (f.dateToExclusive && stamp >= bound(f.dateToExclusive))
                return false;
        }
    }
    return true;
}
interface MutableNode {
    id: string;
    fieldKey: string;
    member: CgPivotMemberValue;
    path: ReadonlyArray<CgPivotMemberValue>;
    level: number;
    children: Map<string, MutableNode>;
}
export async function processPivotData<T>(data: ReadonlyArray<T>, fields: ReadonlyArray<CgPivotField<T>>, query: CgPivotQuery, signal?: AbortSignal): Promise<CgPivotResult> {
    validateFields(fields, true);
    abort(signal);
    const definitions = new Map(fields.map(f => [f.key, f]));
    for (const q of query.fields)
        if (!definitions.has(q.key))
            throw new CgPivotError('Unregistered query field.');
    const rowFields = axisFields(query, 'row'), columnFields = axisFields(query, 'column'), measures = axisFields(query, 'data');
    if (!measures.length)
        return freeze({ rowHierarchy: [], columnHierarchy: [], cells: [], sourceRecordCount: 0 });
    const rows = new Map<string, MutableNode>(), columns = new Map<string, MutableNode>();
    let rowCount = 0, columnCount = 0, sourceRecordCount = 0;
    const cells = new Map<string, {
        row: string;
        column: string;
        field: CgPivotQueryField;
        state: CalculatedState<T>;
    }>();
    const path = (item: T, axis: ReadonlyArray<CgPivotQueryField>) => axis.map(f => createPivotMember(definitions.get(f.key)!.getValue!(item), f, query.locale, query.timeZone));
    const insert = (root: Map<string, MutableNode>, members: ReadonlyArray<CgPivotMemberValue>, axis: ReadonlyArray<CgPivotQueryField>, row: boolean) => { let children = root; members.forEach((member, level) => { let node = children.get(member.key); if (!node) {
        const prefix = members.slice(0, level + 1);
        node = { id: pathKey(prefix), fieldKey: axis[level]!.key, member, path: prefix, level, children: new Map() };
        children.set(member.key, node);
        checkLimit(row ? 'rows' : 'columns', row ? ++rowCount : ++columnCount, row ? query.maxRows : query.maxColumns);
    } children = node.children; }); };
    for (let i = 0; i < data.length; i++) {
        if ((i & 255) === 0) {
            abort(signal);
            if (i)
                await new Promise<void>(resolve => setTimeout(resolve, 0));
            abort(signal);
        }
        const item = data[i]!;
        if (!matchesPivotFilters(item, fields, query))
            continue;
        sourceRecordCount++;
        const rp = path(item, rowFields), cp = path(item, columnFields);
        insert(rows, rp, rowFields, true);
        insert(columns, cp, columnFields, false);
        for (let r = 0; r <= rp.length; r++)
            for (let c = 0; c <= cp.length; c++)
                for (const measure of measures) {
                    const row = pathKey(rp.slice(0, r)), column = pathKey(cp.slice(0, c));
                    const key = cellKey(row, column, measure.key);
                    let cell = cells.get(key);
                    if (!cell) {
                        checkLimit('cells', cells.size + 1, query.maxCells);
                        const field = definitions.get(measure.key)!;
                        if (field.calculated && (measure.summaryType !== 'custom' || measure.customAggregateKey !== field.calculated.key))
                            throw new CgPivotError('Calculated query contract was altered.');
                        cell = { row, column, field: measure, state: fieldAggregate(field, measure.summaryType, query.locale) };
                        cells.set(key, cell);
                    }
                    cell.state.accumulate(item);
                }
    }
    abort(signal);
    const resultCells: CgPivotCell[] = [];
    const lookup = new Map<string, CgPivotValue>();
    for (const [key, c] of cells) {
        const value = c.state.finalizeValue();
        lookup.set(key, value);
        resultCells.push({ rowPathKey: c.row, columnPathKey: c.column, dataFieldKey: c.field.key, summaryType: c.field.summaryType, value, sourceCount: c.state.count });
    }
    const hierarchy = (map: Map<string, MutableNode>, axis: ReadonlyArray<CgPivotQueryField>, row: boolean): CgPivotAxisNode[] => [...map.values()].map(n => ({ ...n, isSubtotal: n.children.size > 0, children: hierarchy(n.children, axis, row) })).sort((a, b) => {
        const f = axis[a.level]!;
        if (f.sortOrder === 'none')
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        const measure = f.sortByMeasureKey ?? measures[0]!.key;
        const av = f.sortMode === 'summaryValue' ? lookup.get(cellKey(row ? a.id : '', row ? '' : a.id, measure)) ?? null : a.member.value;
        const bv = f.sortMode === 'summaryValue' ? lookup.get(cellKey(row ? b.id : '', row ? '' : b.id, measure)) ?? null : b.member.value;
        const type = f.sortMode === 'summaryValue' ? 'decimal' : f.groupInterval === 'year' ? 'number' : f.groupInterval !== 'none' ? 'text' : f.valueType;
        const comparison = av === null && bv === null ? 0 : av === null ? (f.nullPlacement === 'first' ? -1 : 1) : bv === null ? (f.nullPlacement === 'first' ? 1 : -1) : compareValues(av, bv, type, query.locale);
        return comparison * (f.sortOrder === 'descending' ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    const result = { rowHierarchy: hierarchy(rows, rowFields, true), columnHierarchy: hierarchy(columns, columnFields, false), cells: resultCells, sourceRecordCount };
    validatePivotResult(result, query);
    return freeze(result);
}
export async function getPivotDistinctValues<T>(data: ReadonlyArray<T>, fields: ReadonlyArray<CgPivotField<T>>, request: CgPivotDistinctValuesQuery, signal?: AbortSignal): Promise<CgPivotDistinctValuesResult> {
    validatePage(request.skip, request.take);
    abort(signal);
    const field = fields.find(f => f.key === request.fieldKey);
    const queryField = request.pivotQuery.fields.find(f => f.key === request.fieldKey);
    if (!field?.getValue || !queryField)
        throw new CgPivotError('Unknown distinct-value field.');
    const values = new Map<string, CgPivotMemberValue>();
    const search = request.searchText.toLocaleLowerCase(request.pivotQuery.locale);
    for (let i = 0; i < data.length; i++) {
        if ((i & 255) === 0) {
            abort(signal);
            if (i)
                await new Promise<void>(r => setTimeout(r, 0));
        }
        const item = data[i]!;
        if (!matchesPivotFilters(item, fields, request.pivotQuery, request.fieldKey))
            continue;
        const member = createPivotMember(field.getValue(item), queryField, request.pivotQuery.locale, request.pivotQuery.timeZone);
        if (member.displayText.toLocaleLowerCase(request.pivotQuery.locale).includes(search))
            values.set(member.key, member);
    }
    abort(signal);
    const sorted = [...values.values()].sort((a, b) => a.displayText.localeCompare(b.displayText, request.pivotQuery.locale));
    return freeze({ values: sorted.slice(request.skip, request.skip + request.take), totalCount: sorted.length, hasMore: request.skip + request.take < sorted.length });
}
export async function getPivotDrillDown<T>(data: ReadonlyArray<T>, fields: ReadonlyArray<CgPivotField<T>>, request: CgPivotDrillDownQuery, signal?: AbortSignal): Promise<CgPivotDrillDownResult> {
    validatePage(request.skip, request.take);
    checkLimit('drillDown', 0, request.maximumResultSize);
    abort(signal);
    const query = request.pivotQuery;
    const matches: T[] = [];
    let totalCount = 0;
    if (!axisFields(query, 'data').some(f => f.key === request.cell.dataFieldKey))
        throw new CgPivotError('Unauthorized drill-down measure.');
    const axisMatches = (item: T, area: 'row' | 'column', path: ReadonlyArray<CgPivotMemberValue>) => { const axis = axisFields(query, area); return path.every((member, i) => { const q = axis[i]; const f = fields.find(f => f.key === q?.key); return q && f?.getValue && createPivotMember(f.getValue(item), q, query.locale, query.timeZone).key === member.key; }); };
    for (let i = 0; i < data.length; i++) {
        if ((i & 255) === 0) {
            abort(signal);
            if (i)
                await new Promise<void>(r => setTimeout(r, 0));
        }
        const item = data[i]!;
        if (matchesPivotFilters(item, fields, query) && axisMatches(item, 'row', request.cell.rowPath) && axisMatches(item, 'column', request.cell.columnPath)) {
            if (totalCount >= request.skip && matches.length < request.take && totalCount < request.maximumResultSize)
                matches.push(item);
            totalCount++;
        }
    }
    abort(signal);
    const available = fields.filter(f => f.getValue && query.fields.some(q => q.key === f.key));
    return freeze({ columns: available.map(f => ({ key: f.key, caption: f.caption ?? f.key })), rows: matches.map((item, i) => ({ key: String(request.skip + i), values: Object.fromEntries(available.map(f => [f.key, f.getValue!(item)])) })), totalCount: Math.min(totalCount, request.maximumResultSize) });
}
function validatePage(skip: number, take: number): void { if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isSafeInteger(take) || take < 1)
    throw new CgPivotError('Invalid pivot page.'); }
