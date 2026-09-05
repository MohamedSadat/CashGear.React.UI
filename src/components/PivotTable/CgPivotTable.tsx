import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CgToolbar } from '../Toolbar';
import { CgButton } from '../Button';
import { CgLoadingPanel } from '../LoadingPanel';
import { useStableCallback } from '../../hooks/useStableCallback';
import { cx } from '../../utils';
import type { CgPivotActions, CgPivotArea, CgPivotAxisNode, CgPivotCell, CgPivotDrillDownContext, CgPivotExportFormat, CgPivotExportOptions, CgPivotField, CgPivotLayout, CgPivotQuery, CgPivotResult, CgPivotTableProps } from './CgPivotTable.types';
import { CgPivotBrowserLayoutStore, CgPivotError, CgPivotLimitError, abort, createPivotQuery, freeze, normalizePivotLayout, pivotAreas, validateFields, validatePivotResult } from './model';
import { cellKey, processPivotData } from './engine';
import { createPivotExport, downloadPivotExport } from './export';
import { formatPivotValue, pivotProjection } from './projection';
import { english, arabic } from './labels';
import { PivotDrillDown, PivotFieldList, PivotFilter } from './PivotDialogs';
import styles from './CgPivotTable.module.css';
const allPaths = (nodes: ReadonlyArray<CgPivotAxisNode>): string[] => nodes.flatMap(n => [n.id, ...allPaths(n.children)]);
export function CgPivotTable<TItem>(props: CgPivotTableProps<TItem>) {
    const { fields, data, dataProvider } = props;
    if ((data === undefined) === (dataProvider === undefined))
        throw new CgPivotError('Supply exactly one of data or dataProvider.');
    validateFields(fields, data !== undefined);
    const rowHeight = props.rowHeight ?? 34, cellWidth = props.dataCellWidth ?? 132, rowOverscan = props.rowOverscan ?? 6, columnOverscan = props.columnOverscan ?? 3;
    for (const [name, value] of Object.entries({ rowHeight, cellWidth, rowOverscan, columnOverscan, drillDownPageSize: props.drillDownPageSize ?? 50, maximumDrillDownRows: props.maximumDrillDownRows ?? 5000, maximumExportCells: props.maximumExportCells ?? 2000000, layoutSaveDebounce: props.layoutSaveDebounce ?? 500 }))
        if (!Number.isSafeInteger(value) || value < ((name.includes('Overscan') || name === 'layoutSaveDebounce') ? 0 : 1))
            throw new CgPivotError(`Invalid ${name}.`);
    const locale = props.locale ?? 'en-US', direction = props.direction ?? (/^ar|^he|^fa|^ur/.test(locale) ? 'rtl' : 'ltr');
    const labels = { ...(/^ar/.test(locale) ? arabic : english), ...props.labels };
    const [internalLayout, setInternalLayout] = useState(() => normalizePivotLayout(fields, props.defaultLayout));
    const layout = useMemo(() => normalizePivotLayout(fields, props.layout ?? internalLayout), [fields, props.layout, internalLayout]);
    const query = useMemo(() => createPivotQuery(fields, layout, { locale, timeZone: props.groupingTimeZone, maxRows: props.maximumResultRows, maxColumns: props.maximumResultColumns, maxCells: props.maximumResultCells }), [fields, layout, locale, props.groupingTimeZone, props.maximumResultRows, props.maximumResultColumns, props.maximumResultCells]);
    // Expansion changes do not requery. Keep a stable immutable query for child operations.
    const queryText = JSON.stringify(query);
    const stableQuery = useMemo(() => freeze(JSON.parse(queryText) as CgPivotQuery), [queryText]);
    const [result, setResult] = useState<CgPivotResult | null>(null);
    const resultRef = useRef<CgPivotResult | null>(null);
    const [loading, setLoading] = useState(false), [error, setError] = useState<unknown>(), [fieldList, setFieldList] = useState(false), [filterField, setFilterField] = useState<CgPivotField<TItem> | null>(null), [drill, setDrill] = useState<CgPivotDrillDownContext | null>(null);
    const [viewport, setViewport] = useState({ top: 0, left: 0, width: 900, height: 450 });
    const [focus, setFocus] = useState({ row: 0, column: 0 });
    const root = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null);
    const queryOperation = useRef<AbortController | null>(null), exportOperation = useRef<AbortController | null>(null);
    const mounted = useRef(false);
    const drag = useRef<string | null>(null);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const report = useStableCallback((e: unknown, purpose: 'view' | 'export' | 'layout') => props.onError?.(e, purpose));
    const commit = useStableCallback((next: CgPivotLayout) => { const normalized = normalizePivotLayout(fields, next); if (props.layout === undefined)
        setInternalLayout(normalized); props.onLayoutChange?.(normalized); });
    const browserStore = useMemo(() => new CgPivotBrowserLayoutStore(), []);
    const store = props.layoutStore ?? browserStore;
    const context = useMemo(() => ({ layoutKey: props.layoutKey ?? '', schemaSignature: layout.schemaSignature }), [props.layoutKey, layout.schemaSignature]);
    const [storageReady, setStorageReady] = useState<string | null>(null);
    const storageIdentity = JSON.stringify(context);
    const changed = useRef(0);
    const saveController = useRef<AbortController | null>(null);
    const update = useStableCallback((next: CgPivotLayout) => { changed.current++; commit(next); });
    const controlledLayout = useStableCallback(() => props.layout);
    const restore = useStableCallback((saved: unknown, expected: CgPivotLayout | undefined) => { if (saved && props.layout === expected)
        commit(normalizePivotLayout(fields, saved)); });
    /* eslint-disable react-hooks/set-state-in-effect -- storage identity changes and query replacement invalidate transient UI snapshots. */
    useEffect(() => {
        const controller = new AbortController();
        const version = changed.current;
        const expected = controlledLayout();
        if (!context.layoutKey || props.autoLoadLayout === false) {
            setStorageReady(storageIdentity);
            return () => controller.abort();
        }
        setStorageReady(null);
        void Promise.resolve().then(() => store.load(context, controller.signal)).then(saved => { if (!controller.signal.aborted && changed.current === version)
            restore(saved, expected); }).catch(e => { if (!controller.signal.aborted)
            report(e, 'layout'); }).finally(() => { if (!controller.signal.aborted)
            setStorageReady(storageIdentity); });
        return () => controller.abort();
    }, [store, context, storageIdentity, props.autoLoadLayout, restore, report, controlledLayout]);
    useEffect(() => {
        if (!context.layoutKey || storageReady !== storageIdentity || props.autoSaveLayout === false)
            return;
        const controller = new AbortController();
        saveController.current?.abort();
        saveController.current = controller;
        const timer = setTimeout(() => { void Promise.resolve().then(() => store.save(context, layout, controller.signal)).catch(e => { if (!controller.signal.aborted)
            report(e, 'layout'); }); }, props.layoutSaveDebounce ?? 500);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [layout, store, context, storageIdentity, storageReady, props.autoSaveLayout, props.layoutSaveDebounce, report]);
    const load = useStableCallback(async (externalSignal?: AbortSignal) => {
        queryOperation.current?.abort();
        const operation = new AbortController();
        queryOperation.current = operation;
        const stop = () => operation.abort();
        externalSignal?.addEventListener('abort', stop, { once: true });
        if (externalSignal?.aborted)
            operation.abort();
        const started = performance.now();
        const captured = stableQuery;
        const diagnostics = (outcome: 'succeeded' | 'cancelled' | 'failed' | 'limitExceeded', next?: CgPivotResult, limit?: CgPivotLimitError) => props.onDiagnostics?.({ purpose: 'view', outcome, elapsedMs: performance.now() - started, authorizedSourceRowCount: next?.sourceRecordCount ?? 0, rowNodeCount: next ? allPaths(next.rowHierarchy).length : 0, columnNodeCount: next ? allPaths(next.columnHierarchy).length : 0, cellCount: next?.cells.length ?? 0, cancellationRequested: operation.signal.aborted, limit: limit?.limit });
        setLoading(true);
        setError(undefined);
        try {
            abort(operation.signal);
            if (await props.beforeQuery?.(captured, operation.signal) === false) {
                diagnostics('cancelled');
                return;
            }
            abort(operation.signal);
            const next = dataProvider ? await dataProvider.execute(captured, operation.signal) : await processPivotData(data, fields, captured, operation.signal);
            abort(operation.signal);
            validatePivotResult(next, captured);
            if (!mounted.current || queryOperation.current !== operation)
                return;
            const snapshot = freeze(structuredClone(next));
            resultRef.current = snapshot;
            setResult(snapshot);
            props.onQueryCompleted?.(captured, snapshot);
            diagnostics('succeeded', snapshot);
        }
        catch (e) {
            if (operation.signal.aborted) {
                diagnostics('cancelled');
            }
            else if (mounted.current && queryOperation.current === operation) {
                setError(e);
                report(e, 'view');
                props.onQueryFailed?.({ query: captured, error: e, retainedPreviousResult: resultRef.current !== null });
                diagnostics(e instanceof CgPivotLimitError ? 'limitExceeded' : 'failed', undefined, e instanceof CgPivotLimitError ? e : undefined);
            }
        }
        finally {
            externalSignal?.removeEventListener('abort', stop);
            if (mounted.current && queryOperation.current === operation)
                setLoading(false);
        }
    });
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; queryOperation.current?.abort(); exportOperation.current?.abort(); saveController.current?.abort(); clearTimeout(clickTimer.current); }; }, []);
    useEffect(() => { void load(); return () => queryOperation.current?.abort(); }, [load, stableQuery, data, dataProvider, fields]);
    // A changed query invalidates any open drill-down/filter snapshot and in-flight export.
    useEffect(() => { setDrill(null); setFilterField(null); clearTimeout(clickTimer.current); exportOperation.current?.abort(); }, [stableQuery, data, dataProvider, fields]);
    /* eslint-enable react-hooks/set-state-in-effect */
    const projection = useMemo(() => result ? pivotProjection(result, layout, fields, labels.grandTotal) : { rows: [], columns: [] }, [result, layout, fields, labels.grandTotal]);
    const lookup = useMemo(() => new Map(result?.cells.map(c => [cellKey(c.rowPathKey, c.columnPathKey, c.dataFieldKey), c]) ?? []), [result]);
    const expansion = useStableCallback((expanded: boolean) => { if (result)
        update({ ...layout, expandedRowPaths: expanded ? allPaths(result.rowHierarchy) : [], expandedColumnPaths: expanded ? allPaths(result.columnHierarchy) : [], expansionStateInitialized: true }); });
    const toggle = (node: CgPivotAxisNode, row: boolean) => { const paths = row ? layout.expandedRowPaths : layout.expandedColumnPaths; const defaults = allPaths(row ? result!.rowHierarchy : result!.columnHierarchy); const keys = new Set(layout.expansionStateInitialized ? paths : defaults); if (keys.has(node.id))
        keys.delete(node.id);
    else
        keys.add(node.id); update({ ...layout, expandedRowPaths: row ? [...keys] : layout.expansionStateInitialized ? layout.expandedRowPaths : allPaths(result!.rowHierarchy), expandedColumnPaths: row ? layout.expansionStateInitialized ? layout.expandedColumnPaths : allPaths(result!.columnHierarchy) : [...keys], expansionStateInitialized: true }); };
    const reset = useStableCallback(async () => { saveController.current?.abort(); const controller = new AbortController(); await store.delete(context, controller.signal); update(normalizePivotLayout(fields, props.defaultLayout)); });
    const exporting = useStableCallback(async (format: CgPivotExportFormat, options: CgPivotExportOptions = {}) => {
        exportOperation.current?.abort();
        const controller = new AbortController();
        exportOperation.current = controller;
        const cancel = () => controller.abort();
        options.signal?.addEventListener('abort', cancel, { once: true });
        if (options.signal?.aborted)
            controller.abort();
        const start = performance.now();
        try {
            abort(controller.signal);
            if (await props.beforeExport?.(format, controller.signal) === false)
                return null;
            abort(controller.signal);
            const exportQuery = createPivotQuery(fields, layout, { ...stableQuery, purpose: 'export', maxCells: props.maximumExportCells ?? 2000000 });
            let file;
            if (dataProvider) {
                if (!props.exportProvider)
                    throw new CgPivotError('Provider pivots require an exportProvider for complete exports.');
                file = await props.exportProvider.export({ query: exportQuery, layout, format, maximumCells: props.maximumExportCells ?? 2000000, fields: fields.map(f => ({ key: f.key, caption: f.caption ?? f.key, cellFormat: f.cellFormat, currency: f.currency })), rightToLeft: direction === 'rtl' }, controller.signal);
            }
            else {
                const full = await processPivotData(data, fields, exportQuery, controller.signal);
                file = createPivotExport(full, layout, fields, format, { ...options, rightToLeft: direction === 'rtl', locale, maximumCells: props.maximumExportCells, signal: controller.signal, grandTotalText: labels.grandTotal });
            }
            abort(controller.signal);
            if (options.download)
                downloadPivotExport(file);
            props.onExportCompleted?.(file);
            props.onDiagnostics?.({ purpose: 'export', outcome: 'succeeded', elapsedMs: performance.now() - start, authorizedSourceRowCount: resultRef.current?.sourceRecordCount ?? 0, rowNodeCount: 0, columnNodeCount: 0, cellCount: 0, cancellationRequested: false });
            return file;
        }
        catch (e) {
            props.onDiagnostics?.({ purpose: 'export', outcome: controller.signal.aborted ? 'cancelled' : e instanceof CgPivotLimitError ? 'limitExceeded' : 'failed', elapsedMs: performance.now() - start, authorizedSourceRowCount: 0, rowNodeCount: 0, columnNodeCount: 0, cellCount: 0, cancellationRequested: controller.signal.aborted, limit: e instanceof CgPivotLimitError ? e.limit : undefined });
            if (controller.signal.aborted)
                return null;
            report(e, 'export');
            throw e;
        }
        finally {
            options.signal?.removeEventListener('abort', cancel);
        }
    });
    const applyFieldList = (next:CgPivotLayout) => {
        update(next);
        for(const field of next.fields){
            const previous=layout.fields.find(f=>f.key===field.key);
            if(!previous)continue;
            if(previous.area!==field.area||previous.areaIndex!==field.areaIndex)props.onFieldAreaChange?.({fieldKey:field.key,oldArea:previous.area,newArea:field.area,areaIndex:field.areaIndex});
            if(previous.sortOrder!==field.sortOrder||previous.sortMode!==field.sortMode||previous.sortByMeasureKey!==field.sortByMeasureKey)props.onFieldSortChange?.(field);
        }
    };
    const getLayout = useStableCallback(() => layout);
    const showFieldList = useStableCallback(() => { if (!props.disabled && !props.readOnly)
        setFieldList(true); });
    const actions = useMemo<CgPivotActions>(() => ({ refresh: load, expandAll: () => expansion(true), collapseAll: () => expansion(false), showFieldList, resetLayout: reset, exportXlsx: options => exporting('xlsx', options), exportCsv: options => exporting('csv', options), getLayout, getResult: () => resultRef.current }), [load, expansion, reset, exporting, getLayout, showFieldList]);
    useImperativeHandle(props.actionsRef, () => actions, [actions]);
    useEffect(() => { const element = scroll.current; if (!element)
        return; let frame = 0; const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setViewport({ top: element.scrollTop, left: Math.abs(element.scrollLeft), width: element.clientWidth || 900, height: element.clientHeight || 450 })); }; measure(); element.addEventListener('scroll', measure, { passive: true }); const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure); observer?.observe(element); return () => { element.removeEventListener('scroll', measure); observer?.disconnect(); cancelAnimationFrame(frame); }; }, []);
    const virtual = props.virtualScrolling !== false;
    const rowStart = virtual ? Math.max(0, Math.floor(viewport.top / rowHeight) - rowOverscan) : 0, rowEnd = virtual ? Math.min(projection.rows.length, Math.ceil((viewport.top + viewport.height) / rowHeight) + rowOverscan) : projection.rows.length;
    const colStart = virtual ? Math.max(0, Math.floor(viewport.left / cellWidth) - columnOverscan) : 0, colEnd = virtual ? Math.min(projection.columns.length, Math.ceil((viewport.left + viewport.width) / cellWidth) + columnOverscan) : projection.columns.length;
    const rowIndices = [...new Set([...Array.from({ length: Math.max(0, rowEnd - rowStart) }, (_, i) => i + rowStart), Math.min(focus.row, projection.rows.length - 1)])].filter(i => i >= 0).sort((a, b) => a - b);
    const colIndices = [...new Set([...Array.from({ length: Math.max(0, colEnd - colStart) }, (_, i) => i + colStart), Math.min(focus.column, projection.columns.length - 1)])].filter(i => i >= 0).sort((a, b) => a - b);
    const interactionBlocked = props.disabled || props.readOnly;
    const moveField = (key: string, area: CgPivotArea, before?: string) => { if (interactionBlocked)
        return; const definition = fields.find(f => f.key === key); const current = layout.fields.find(f => f.key === key); if (!definition || !current || area !== 'hidden' && definition.allowedAreas && !definition.allowedAreas.includes(area))
        return; const siblings = layout.fields.filter(f => f.area === area && f.key !== key).sort((a, b) => a.areaIndex - b.areaIndex); const at = before ? siblings.findIndex(f => f.key === before) : siblings.length; siblings.splice(at < 0 ? siblings.length : at, 0, { ...current, area }); const indices = new Map(siblings.map((f, i) => [f.key, i])); update({ ...layout, fields: layout.fields.map(f => f.key === key ? { ...f, area, areaIndex: indices.get(f.key)! } : indices.has(f.key) ? { ...f, areaIndex: indices.get(f.key)! } : f) }); props.onFieldAreaChange?.({ fieldKey: key, oldArea: current.area, newArea: area, areaIndex: indices.get(key)! }); };
    const contextFor = (r: number, c: number): CgPivotDrillDownContext => { const row = projection.rows[r]!, column = projection.columns[c]!; const cell = lookup.get(cellKey(row.key, column.axis.key, column.measure.key)); return freeze({ rowPath: row.node?.path ?? [], columnPath: column.axis.node?.path ?? [], dataFieldKey: column.measure.key, summaryType: column.measure.summaryType, aggregatedValue: cell?.value ?? null, coordinates: { rowIndex: r, columnIndex: c }, activeFilters: stableQuery.fields.filter(f => f.filter) }); };
    const activate = (r: number, c: number, drillDown = false) => { const context = contextFor(r, c); if (drillDown) {
        props.onDrillDown?.(context);
        setDrill(context);
    }
    else
        props.onCellClick?.(context); };
    const keyDown = (event: KeyboardEvent<HTMLDivElement>, r: number, c: number) => { if (event.target !== event.currentTarget || props.disabled)
        return; let nextRow = r, nextCol = c; switch (event.key) {
        case 'ArrowDown':
            nextRow++;
            break;
        case 'ArrowUp':
            nextRow--;
            break;
        case 'ArrowLeft':
            nextCol += direction === 'rtl' ? 1 : -1;
            break;
        case 'ArrowRight':
            nextCol += direction === 'rtl' ? -1 : 1;
            break;
        case 'Home':
            nextCol = 0;
            if (event.ctrlKey)
                nextRow = 0;
            break;
        case 'End':
            nextCol = projection.columns.length - 1;
            if (event.ctrlKey)
                nextRow = projection.rows.length - 1;
            break;
        case 'PageDown':
            nextRow += Math.max(1, Math.floor(viewport.height / rowHeight));
            break;
        case 'PageUp':
            nextRow -= Math.max(1, Math.floor(viewport.height / rowHeight));
            break;
        case 'Enter':
        case ' ':
            event.preventDefault();
            activate(r, c, event.key === 'Enter' && (event.ctrlKey || event.metaKey));
            return;
        default: return;
    } event.preventDefault(); nextRow = Math.max(0, Math.min(projection.rows.length - 1, nextRow)); nextCol = Math.max(0, Math.min(projection.columns.length - 1, nextCol)); setFocus({ row: nextRow, column: nextCol }); if (scroll.current) {
        scroll.current.scrollTop = nextRow * rowHeight;
        scroll.current.scrollLeft = (direction === 'rtl' ? -1 : 1) * nextCol * cellWidth;
    } requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-pivot-cell="${nextRow}:${nextCol}"]`)?.focus({ preventScroll: true })); };
    const rowHeaderWidth = 220, headerHeight = 68;
    return <div ref={root} id={props.id} className={cx(styles.root, props.className)} style={props.style} dir={direction} data-density={props.density ?? 'compact'} data-cg-pivot-ready={!loading} aria-label={props['aria-label'] ?? labels.table} aria-disabled={props.disabled || undefined}>
    {props.showToolbar !== false ? <CgToolbar ariaLabel={labels.table} direction={direction} items={[
                { name: 'fields', text: labels.fields, visible: props.showFieldListButton !== false, disabled: interactionBlocked, onClick: () => setFieldList(true) },
                { name: 'expand', text: labels.expandAll, disabled: props.disabled, onClick: () => expansion(true) }, { name: 'collapse', text: labels.collapseAll, disabled: props.disabled, onClick: () => expansion(false) },
                { name: 'refresh', text: labels.refresh, disabled: props.disabled, onClick: () => load() }, { name: 'reset', text: labels.reset, disabled: interactionBlocked, onClick: reset },
                { name: 'xlsx', text: labels.exportXlsx, disabled: props.disabled || Boolean(dataProvider && !props.exportProvider), onClick: async () => { await exporting('xlsx', { download: true }); } },
                { name: 'csv', text: labels.exportCsv, disabled: props.disabled || Boolean(dataProvider && !props.exportProvider), onClick: async () => { await exporting('csv', { download: true }); } },
            ]} onItemError={e => { setError(e); }}/> : null}
    {props.showFieldPanel !== false ? <div className={styles.fieldPanel}>{pivotAreas.filter(a => a !== 'hidden').map(area => <section key={area} className={styles.area} aria-label={labels[area === 'row' ? 'rows' : area === 'column' ? 'columns' : area]} data-pivot-area={area} onDragOver={e => { if (drag.current)
                e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (drag.current)
                moveField(drag.current, area); drag.current = null; }}><span className={styles.areaLabel}>{labels[area === 'row' ? 'rows' : area === 'column' ? 'columns' : area]}</span>{layout.fields.filter(f => f.area === area && f.visible).sort((a, b) => a.areaIndex - b.areaIndex).map(state => {
                    const field = fields.find(f => f.key === state.key)!;
                    const title = field.caption ?? field.key;
                    return <div className={styles.chip} key={state.key} draggable={!interactionBlocked} data-pivot-field={state.key} onDragStart={e => { drag.current = state.key; e.dataTransfer.setData('text/plain', state.key); }} onDragEnd={() => { drag.current = null; }} onDragOver={e => { if (drag.current)
                        e.preventDefault(); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); if (drag.current)
                        moveField(drag.current, area, state.key); drag.current = null; }}>
        <span aria-hidden="true" className={styles.dragHandle} data-pivot-drag-handle={state.key} draggable={!interactionBlocked}>⠿</span>
        <button type="button" disabled={interactionBlocked} aria-label={`${title} ${labels.sort}`} onClick={() => { const sortOrder = state.sortOrder === 'none' ? 'ascending' : state.sortOrder === 'ascending' ? 'descending' : 'none'; const next = { ...state, sortOrder } as typeof state; update({ ...layout, fields: layout.fields.map(f => f.key === state.key ? next : f) }); props.onFieldSortChange?.(next); }}>{field.renderHeader?.(state) ?? title}{state.sortOrder === 'ascending' ? ' ↑' : state.sortOrder === 'descending' ? ' ↓' : ''}</button>
        <select aria-label={`${title} ${labels.area}`} disabled={interactionBlocked} value={area} onChange={e => moveField(state.key, e.target.value as CgPivotArea)}>{pivotAreas.filter(a => a === 'hidden' || !field.allowedAreas || field.allowedAreas.includes(a)).map(a => <option key={a} value={a}>{labels[a === 'column' ? 'columns' : a === 'row' ? 'rows' : a]}</option>)}</select>
        {!field.calculated ? <button type="button" disabled={interactionBlocked} aria-label={`${title} ${labels.filter}`} onClick={() => setFilterField(field)}>⌕</button> : null}</div>;
                })}</section>)}</div> : null}
    {loading ? (props.renderLoading?.() ?? <CgLoadingPanel visible text={labels.loading}/>) : null}
    {error ? <div role="alert" className={styles.message}>{props.renderError?.({ error, retainedPreviousResult: result !== null }) ?? (error instanceof CgPivotLimitError ? labels.limit : labels.error)}<CgButton onClick={() => load()}>{labels.retry}</CgButton></div> : null}
    {result?.isPartial ? <div role="status" className={styles.message}>{labels.partial}</div> : null}
    {!loading && result?.sourceRecordCount === 0 ? <div className={styles.message}>{props.renderEmpty?.() ?? labels.empty}</div> : null}
    <div ref={scroll} className={styles.viewport} style={{ height: props.height ?? '38rem' }}>
      <div role="grid" aria-label={props['aria-label'] ?? labels.table} aria-rowcount={projection.rows.length + 1} aria-colcount={projection.columns.length + 1} aria-busy={loading} style={{ position: 'relative', width: rowHeaderWidth + projection.columns.length * cellWidth, minWidth: '100%', height: headerHeight + projection.rows.length * rowHeight }}>
        <div role="row" aria-rowindex={1} className={styles.headers} style={{ height: headerHeight }}>
          <div role="columnheader" aria-colindex={1} className={styles.corner} style={{ width: rowHeaderWidth, height: headerHeight }}>{labels.rows}</div>
          {colIndices.map(c => {
            const column = projection.columns[c]!;
            const node = column.axis.node;
            return <div key={`${column.axis.key}:${column.measure.key}`} role="columnheader" aria-colindex={c + 2} className={styles.columnHeader} style={{ insetInlineStart: rowHeaderWidth + c * cellWidth, width: cellWidth, height: headerHeight }}>
              <div title={node?.path.map(p => p.displayText).join(' / ')}>{node && props.renderColumnHeader ? props.renderColumnHeader({ node, isRowAxis: false, isExpanded: column.axis.expanded }) : node?.path.map(p => p.isBlank ? labels.blank : p.displayText).join(' / ') ?? column.axis.label}{node?.children.length ? <button type="button" disabled={props.disabled} aria-label={`${column.axis.expanded ? labels.collapseAll : labels.expandAll}: ${column.axis.label}`} aria-expanded={column.axis.expanded} onClick={() => toggle(node, false)}>{column.axis.expanded ? '−' : '+'}</button> : null}</div><strong>{column.field.caption ?? column.field.key}</strong></div>;
        })}
        </div>
        {rowIndices.map(r => {
            const row = projection.rows[r]!, node = row.node;
            return <div role="row" aria-rowindex={r + 2} key={row.key || 'grand'} className={styles.row} style={{ position: 'absolute', top: headerHeight + r * rowHeight, height: rowHeight, width: '100%' }}>
            <div role="rowheader" aria-colindex={1} className={styles.rowHeader} style={{ width: rowHeaderWidth, height: rowHeight, paddingInlineStart: 8 + (node?.level ?? 0) * 16 }}>{node?.children.length ? <button type="button" disabled={props.disabled} aria-label={`${row.expanded ? labels.collapseAll : labels.expandAll}: ${row.label}`} aria-expanded={row.expanded} onClick={() => toggle(node, true)}>{row.expanded ? '−' : '+'}</button> : null}{node && props.renderRowHeader ? props.renderRowHeader({ node, isRowAxis: true, isExpanded: row.expanded }) : (node && fields.find(f => f.key === node.fieldKey)?.renderValue?.(node.member)) ?? (node?.member.isBlank ? labels.blank : row.label)}</div>
            {colIndices.map(c => { const column = projection.columns[c]!; const cell: CgPivotCell = lookup.get(cellKey(row.key, column.axis.key, column.measure.key)) ?? { rowPathKey: row.key, columnPathKey: column.axis.key, dataFieldKey: column.measure.key, summaryType: column.measure.summaryType, value: null, sourceCount: 0 }; const context = { cell, formattedValue: formatPivotValue(cell.value, column.field, locale), isTotal: row.total || column.axis.total }; return <div key={`${column.axis.key}:${column.measure.key}`} role="gridcell" aria-colindex={c + 2} className={cx(styles.cell, context.isTotal && styles.total)} data-pivot-cell={`${r}:${c}`} tabIndex={!props.disabled && r === Math.min(focus.row, projection.rows.length - 1) && c === Math.min(focus.column, projection.columns.length - 1) ? 0 : -1} style={{ insetInlineStart: rowHeaderWidth + c * cellWidth, width: cellWidth, height: rowHeight }} onFocus={() => setFocus({ row: r, column: c })} onKeyDown={e => keyDown(e, r, c)} onClick={() => { if (props.disabled)
                return; clearTimeout(clickTimer.current); clickTimer.current = setTimeout(() => activate(r, c), 220); }} onDoubleClick={() => { if (props.disabled)
                return; clearTimeout(clickTimer.current); props.onCellDoubleClick?.(contextFor(r, c)); activate(r, c, true); }}>{column.field.renderCell?.(context) ?? (context.isTotal ? props.renderTotalCell?.(context) : undefined) ?? props.renderCell?.(context) ?? context.formattedValue}</div>; })}
          </div>;
        })}
      </div>
    </div>
    {fieldList ? <PivotFieldList fields={fields} layout={layout} labels={labels} deferred={props.deferredFieldListChanges !== false} onClose={() => setFieldList(false)} onApply={applyFieldList}/> : null}
    {filterField ? <PivotFilter field={filterField} query={stableQuery} props={props} labels={labels} onClose={() => setFilterField(null)} onApply={filter => { update({ ...layout, fields: layout.fields.map(f => f.key === filterField.key ? { ...f, filter } : f) }); props.onFieldFilterChange?.({ fieldKey: filterField.key, filter }); }}/> : null}
    {drill ? <PivotDrillDown cell={drill} query={stableQuery} props={props} labels={labels} onClose={() => setDrill(null)}/> : null}
  </div>;
}
