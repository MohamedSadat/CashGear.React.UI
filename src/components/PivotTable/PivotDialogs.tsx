import { useEffect, useState } from 'react';
import { CgPopup } from '../Popup';
import { CgButton } from '../Button';
import { CgSearchBox } from '../SearchBox';
import { CgGrid } from '../Grid';
import { CgPager } from '../Pager';
import { useStableCallback } from '../../hooks/useStableCallback';
import type { CgPivotDrillDownRow, CgPivotDrillDownContext, CgPivotDrillDownResult, CgPivotField, CgPivotFieldFilter, CgPivotLabels, CgPivotLayout, CgPivotQuery, CgPivotTableProps, CgPivotDistinctValuesResult } from './CgPivotTable.types';
import { getPivotDistinctValues, getPivotDrillDown } from './engine';
import { normalizePivotLayout, pivotAreas, pivotSummaries, CgPivotError, CgPivotLimitError, validMember, validScalar } from './model';
import styles from './CgPivotTable.module.css';
import { decimal, compareDecimal } from './decimal';
export function PivotFieldList<T>({ fields, layout, labels, onClose, onApply, deferred }: {
    fields: ReadonlyArray<CgPivotField<T>>;
    layout: CgPivotLayout;
    labels: CgPivotLabels;
    onClose: () => void;
    onApply: (layout: CgPivotLayout) => void;
    deferred: boolean;
}) {
    const [draft, setDraft] = useState(layout);
    const change = (next: CgPivotLayout) => { const normalized = normalizePivotLayout(fields, next); setDraft(normalized); if (!deferred)
        onApply(normalized); };
    const patch = (key: string, values: Partial<CgPivotLayout['fields'][number]>) => change({ ...draft, fields: draft.fields.map(f => f.key === key ? { ...f, ...values } : f) });
    const move = (key: string, delta: number) => { const state = draft.fields.find(f => f.key === key)!; const siblings = draft.fields.filter(f => f.area === state.area).sort((a, b) => a.areaIndex - b.areaIndex); const target = siblings[state.areaIndex + delta]; if (target)
        change({ ...draft, fields: draft.fields.map(f => f.key === key ? { ...f, areaIndex: target.areaIndex } : f.key === target.key ? { ...f, areaIndex: state.areaIndex } : f) }); };
    return <CgPopup className={styles.popup} open onOpenChange={open => { if (!open)
        onClose(); }} headerText={labels.fields} width="min(58rem, 96vw)"><div className={styles.fieldList}>{[...draft.fields].sort((a, b) => pivotAreas.indexOf(a.area) - pivotAreas.indexOf(b.area) || a.areaIndex - b.areaIndex).map(state => {
            const field = fields.find(f => f.key === state.key)!;
            const title = field.caption ?? field.key;
            return <fieldset key={state.key} className={styles.fieldSettings}><legend>{title}</legend>
      <label>{labels.area}<select aria-label={`${title} ${labels.area}`} value={state.area} onChange={e => patch(state.key, { area: e.target.value as typeof state.area, areaIndex: 64 })}>{pivotAreas.filter(a => a === 'hidden' || !field.allowedAreas || field.allowedAreas.includes(a)).map(a => <option key={a} value={a}>{labels[a === 'column' ? 'columns' : a === 'row' ? 'rows' : a]}</option>)}</select></label>
      <label>{labels.summary}<select aria-label={`${title} ${labels.summary}`} disabled={state.area !== 'data' || Boolean(field.calculated)} value={state.summaryType} onChange={e => patch(state.key, { summaryType: e.target.value as typeof state.summaryType })}>{pivotSummaries.filter(s => s !== 'custom' || Boolean(field.customAggregateKey ?? field.customAggregate?.key ?? field.calculated)).map(s => <option key={s}>{s}</option>)}</select></label>
      <label>{labels.sort}<select aria-label={`${title} ${labels.sort}`} value={state.sortOrder} onChange={e => patch(state.key, { sortOrder: e.target.value as typeof state.sortOrder })}>{['none', 'ascending', 'descending'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>{labels.sortMode}<select aria-label={`${title} ${labels.sortMode}`} value={state.sortMode} onChange={e => patch(state.key, { sortMode: e.target.value as typeof state.sortMode })}><option value="displayValue">{labels.area}</option><option value="summaryValue">{labels.measure}</option></select></label>
      {state.sortMode === 'summaryValue' ? <label>{labels.measure}<select aria-label={`${title} ${labels.measure}`} value={state.sortByMeasureKey ?? ''} onChange={e => patch(state.key, { sortByMeasureKey: e.target.value })}>{draft.fields.filter(f => f.area === 'data' && f.visible).map(f => <option key={f.key} value={f.key}>{fields.find(d => d.key === f.key)?.caption ?? f.key}</option>)}</select></label> : null}
      <CgButton size="small" aria-label={`${title} ${labels.moveUp}`} onClick={() => move(state.key, -1)}>↑</CgButton><CgButton size="small" aria-label={`${title} ${labels.moveDown}`} onClick={() => move(state.key, 1)}>↓</CgButton>
    </fieldset>;
        })}<fieldset><legend>{labels.totals}</legend><label><input type="checkbox" checked={draft.showRowGrandTotals} onChange={e => change({ ...draft, showRowGrandTotals: e.target.checked })}/>{labels.rows}</label><label><input type="checkbox" checked={draft.showColumnGrandTotals} onChange={e => change({ ...draft, showColumnGrandTotals: e.target.checked })}/>{labels.columns}</label><label>{labels.rows}<select aria-label={`${labels.rows} total placement`} value={draft.rowTotalPlacement} onChange={e => change({ ...draft, rowTotalPlacement: e.target.value as 'near' | 'far' })}><option>near</option><option>far</option></select></label><label>{labels.columns}<select aria-label={`${labels.columns} total placement`} value={draft.columnTotalPlacement} onChange={e => change({ ...draft, columnTotalPlacement: e.target.value as 'near' | 'far' })}><option>near</option><option>far</option></select></label></fieldset><div className={styles.actions}><CgButton onClick={onClose}>{labels.cancel}</CgButton><CgButton intent="primary" onClick={() => { onApply(draft); onClose(); }}>{labels.apply}</CgButton></div></div></CgPopup>;
}
export function PivotFilter<T>({ field, query, props, labels, onClose, onApply }: {
    field: CgPivotField<T>;
    query: CgPivotQuery;
    props: CgPivotTableProps<T>;
    labels: CgPivotLabels;
    onClose: () => void;
    onApply: (filter: CgPivotFieldFilter) => void;
}) {
    const initial = query.fields.find(f => f.key === field.key)?.filter;
    const [filter, setFilter] = useState<CgPivotFieldFilter>(initial ?? {});
    const [search, setSearch] = useState('');
    const [skip, setSkip] = useState(0);
    const [result, setResult] = useState<CgPivotDistinctValuesResult>({ values: [], totalCount: 0, hasMore: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>();
    const [retry, setRetry] = useState(0);
    const [committedSearch, setCommittedSearch] = useState('');
    const load = useStableCallback(async (signal: AbortSignal) => {
        const start = performance.now();
        const request = { fieldKey: field.key, pivotQuery: query, searchText: committedSearch, skip, take: 100 };
        setLoading(true);
        setError(undefined);
        try {
            const next = props.dataProvider ? await props.dataProvider.getDistinctValues(request, signal) : await getPivotDistinctValues(props.data, props.fields, request, signal);
            signal.throwIfAborted();
            if (!Number.isSafeInteger(next.totalCount) || next.totalCount < 0 || !next.values.every(validMember) || next.values.length > request.take || new Set(next.values.map(v => v.key)).size !== next.values.length)
                throw new CgPivotError('Invalid distinct-values response.');
            setResult(old => ({ ...next, values: skip ? [...new Map([...old.values, ...next.values].map(v => [v.key, v])).values()] : next.values }));
            props.onDiagnostics?.({ purpose: 'distinctValues', outcome: 'succeeded', elapsedMs: performance.now() - start, authorizedSourceRowCount: next.totalCount, rowNodeCount: 0, columnNodeCount: 0, cellCount: 0, cancellationRequested: false });
        }
        catch (e) {
            props.onDiagnostics?.({ purpose: 'distinctValues', outcome: signal.aborted ? 'cancelled' : e instanceof CgPivotLimitError ? 'limitExceeded' : 'failed', elapsedMs: performance.now() - start, authorizedSourceRowCount: 0, rowNodeCount: 0, columnNodeCount: 0, cellCount: 0, cancellationRequested: signal.aborted, limit: e instanceof CgPivotLimitError ? e.limit : undefined });
            if (!signal.aborted) {
                setError(e);
                props.onError?.(e, 'distinctValues');
            }
        }
        finally {
            if (!signal.aborted)
                setLoading(false);
        }
    });
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, committedSearch, skip, retry, query]);
    const selected = new Set(filter.includedMemberKeys ?? []);
    const excluded = new Set(filter.excludedMemberKeys ?? []);
    const active = filter.memberSelectionActive || selected.size > 0;
    return <CgPopup className={styles.popup} open onOpenChange={open => { if (!open)
        onClose(); }} headerText={`${labels.filter}: ${field.caption ?? field.key}`} width="min(32rem, 96vw)"><div className={styles.dialog}>
    <CgSearchBox query={search} onQueryChange={setSearch} onSearch={value => { setCommittedSearch(value); setSkip(0); }} searchMode="debounced" searchAriaLabel={labels.search} aria-label={labels.search}/>
    <div className={styles.actions}><CgButton onClick={() => setFilter({ ...filter, memberSelectionActive: false, includedMemberKeys: [], excludedMemberKeys: [], includedValues: [] })}>{labels.selectAll}</CgButton><CgButton onClick={() => setFilter({ ...filter, memberSelectionActive: true, includedMemberKeys: [], excludedMemberKeys: [], includedValues: [] })}>{labels.clearAll}</CgButton></div>
    <div className={styles.filterValues}>{result.values.map(member => <label key={member.key}><input type="checkbox" checked={active ? selected.has(member.key) : !excluded.has(member.key)} onChange={e => { const keys = new Set(active ? selected : excluded); if (e.target.checked === Boolean(active))
        keys.add(member.key);
    else
        keys.delete(member.key); setFilter({ ...filter, memberSelectionActive: Boolean(active), includedMemberKeys: active ? [...keys] : [], excludedMemberKeys: active ? [] : [...keys], includedValues: [] }); }}/>{member.isBlank ? labels.blank : member.displayText}</label>)}</div>
    {loading ? <div role="status">{labels.loading}</div> : null}{error ? <div role="alert">{labels.error}<CgButton onClick={() => setRetry(n => n + 1)}>{labels.retry}</CgButton></div> : null}{result.hasMore ? <CgButton disabled={loading} onClick={() => setSkip(result.values.length)}>{labels.more}</CgButton> : null}
    {['number', 'decimal'].includes(field.valueType) ? <div className={styles.ranges}>{(['minimum', 'maximum'] as const).map(key => <label key={key}>{labels[key]}<input aria-label={labels[key]} inputMode="decimal" value={String(filter[key] ?? '')} onChange={e => setFilter({ ...filter, [key]: e.target.value || undefined })}/></label>)}</div> : null}
    {['date', 'dateTime', 'instant'].includes(field.valueType) ? <div className={styles.ranges}>{(['dateFrom', 'dateToExclusive'] as const).map(key => <label key={key}>{key === 'dateFrom' ? labels.dateFrom : labels.dateTo}<input type="date" aria-label={key === 'dateFrom' ? labels.dateFrom : labels.dateTo} value={filter[key]?.slice(0, 10) ?? ''} onChange={e => setFilter({ ...filter, [key]: e.target.value || undefined })}/></label>)}</div> : null}
    <div className={styles.actions}><CgButton onClick={onClose}>{labels.cancel}</CgButton><CgButton intent="primary" onClick={() => { try {
        if (['number', 'decimal'].includes(field.valueType)) {
            const min = filter.minimum == null ? undefined : decimal(String(filter.minimum));
            const max = filter.maximum == null ? undefined : decimal(String(filter.maximum));
            if (min && max && compareDecimal(min, max) > 0)
                throw new CgPivotError('Invalid range.');
        }
        if (filter.dateFrom && filter.dateToExclusive && filter.dateFrom >= filter.dateToExclusive)
            throw new CgPivotError('Invalid date range.');
        onApply(filter);
        onClose();
    }
    catch (e) {
        setError(e);
    } }}>{labels.apply}</CgButton></div>
  </div></CgPopup>;
}
export function PivotDrillDown<T>({ cell, query, props, labels, onClose }: {
    cell: CgPivotDrillDownContext;
    query: CgPivotQuery;
    props: CgPivotTableProps<T>;
    labels: CgPivotLabels;
    onClose: () => void;
}) {
    const direction=props.direction??(/^ar|^he|^fa|^ur/.test(props.locale??'')?'rtl':'ltr');
    const [page, setPage] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState<unknown>(), [retry, setRetry] = useState(0);
    const [result, setResult] = useState<CgPivotDrillDownResult>({ columns: [], rows: [], totalCount: 0 });
    const take = props.drillDownPageSize ?? 50, maximum = props.maximumDrillDownRows ?? 5000;
    const load = useStableCallback(async (signal: AbortSignal) => { setLoading(true); setError(undefined); const request = { pivotQuery: query, cell, skip: page * take, take, maximumResultSize: maximum }; const start = performance.now(); try {
        const next = props.dataProvider ? await props.dataProvider.getDrillDown(request, signal) : await getPivotDrillDown(props.data, props.fields, request, signal);
        signal.throwIfAborted();
        if (!Number.isSafeInteger(next.totalCount) || next.totalCount < 0 || next.totalCount > maximum || new Set(next.columns.map(c => c.key)).size !== next.columns.length || next.columns.some(c => !query.fields.some(f => f.key === c.key)) || next.rows.some(r => Object.values(r.values).some(v => !validScalar(v)) || Object.keys(r.values).some(key=>!next.columns.some(c=>c.key===key))) || next.rows.length > take || new Set(next.rows.map(r => r.key)).size !== next.rows.length)
            throw new CgPivotError('Invalid drill-down response.');
        setResult(next);
        props.onDiagnostics?.({ purpose: 'drillDown', outcome: 'succeeded', elapsedMs: performance.now() - start, authorizedSourceRowCount: next.totalCount, rowNodeCount: 0, columnNodeCount: 0, cellCount: 0, cancellationRequested: false });
    }
    catch (e) {
        props.onDiagnostics?.({ purpose: 'drillDown', outcome: signal.aborted ? 'cancelled' : e instanceof CgPivotLimitError ? 'limitExceeded' : 'failed', elapsedMs: performance.now() - start, authorizedSourceRowCount: 0, rowNodeCount: 0, columnNodeCount: 0, cellCount: 0, cancellationRequested: signal.aborted, limit: e instanceof CgPivotLimitError ? e.limit : undefined });
        if (!signal.aborted) {
            setError(e);
            props.onError?.(e, 'drillDown');
        }
    }
    finally {
        if (!signal.aborted)
            setLoading(false);
    } });
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, page, take, maximum, query, retry]);
    return <CgPopup className={styles.popup} open onOpenChange={open => { if (!open)
        onClose(); }} headerText={labels.drillDown} width="min(72rem,96vw)"><div className={styles.dialog}>{loading ? <div role="status">{labels.loading}</div> : null}{error ? <div role="alert">{labels.error}<CgButton onClick={() => setRetry(n => n + 1)}>{labels.retry}</CgButton></div> : props.renderDrillDown ? props.renderDrillDown({ cell, result }) : result.columns.length ? <CgGrid<CgPivotDrillDownRow> direction={direction} data={result.rows} keySelector={r => r.key} columns={result.columns.map(c => ({ type: 'text' as const, fieldId: c.key, title: c.caption, accessor: r => String(r.values[c.key] ?? '') }))} showSearch={false} showFilterRow={false} showPager={false} defaultState={{ pageSize: take }} aria-label={labels.drillDown}/> : null}<CgPager direction={direction} labels={{previousPage:labels.previous,nextPage:labels.next}} pageIndex={page} pageSize={take} totalItemCount={Math.min(result.totalCount, maximum)} onPageIndexChange={setPage} loading={loading} navigationLabel={labels.drillDown}/></div></CgPopup>;
}
