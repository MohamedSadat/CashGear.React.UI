/* eslint-disable react-hooks/refs -- refs hold delegated browser state and authoritative controlled snapshots without driving pointer renders. */
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useDirection, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import type {
  CgChartActions,
  CgChartDashStyle,
  CgChartLegendItemRenderContext,
  CgChartPointEventDetail,
  CgChartPointRef,
  CgChartProps,
  CgChartSelectionChangeDetail,
  CgChartSeriesDescriptor,
} from './CgChart.types';
import { chartMessage, createChartFormatter, resolveChartStrings } from './chartFormatting';
import {
  downloadChartSvg,
  registerChartBrowser,
  serializeChartSvg,
} from './chartBrowser';
import type { ChartBrowserController } from './chartBrowser';
import { markerPath } from './chartGeometry';
import { buildChartLayout } from './chartLayout';
import type { ChartHitTarget, ChartPointShape, ChartShape } from './chartLayout';
import {
  buildChartSourceModel,
  pointByRef,
  projectVisibleModel,
} from './chartModel';
import type { ChartPoint, ChartSeries } from './chartModel';
import { svgNumber } from './chartPaths';
import {
  initialVisibleSeriesNames,
  normalizePointRefs,
  normalizeVisibleSeriesNames,
  pointRefKey,
  proposePointSelection,
  samePointRefs,
  selectionDetail,
} from './chartState';
import { projectChartTable } from './chartTable';
import { validateChartConfiguration } from './chartValidation';
import styles from './CgChart.module.css';

export const CG_CHART_PRIMARY_AXIS_NAME = 'primary' as const;

const DASH_ARRAY: Readonly<Record<CgChartDashStyle, string | undefined>> = {
  solid: undefined,
  dash: '8 5',
  dot: '2 4',
  dashDot: '8 4 2 4',
};

function requestBrowserFrame(callback: FrameRequestCallback): number {
  return typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16);
}

function cancelBrowserFrame(frame: number): void {
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
  else window.clearTimeout(frame);
}

function renderMarker(shape: ChartPointShape, key: string): ReactElement | null {
  if (shape.markerSymbol === 'none') return null;
  if (shape.markerSymbol === 'circle' || shape.markerSymbol === 'auto') {
    return <circle key={key} cx={shape.x} cy={shape.y} r={shape.markerSize / 2} fill={shape.color} opacity={shape.opacity} className={shape.className} />;
  }
  const path = markerPath(shape.markerSymbol, shape.x, shape.y, shape.markerSize);
  const cross = shape.markerSymbol === 'cross';
  return <path key={key} d={path} fill={cross ? 'none' : shape.color} stroke={shape.color} strokeWidth={cross ? 2 : 1} opacity={shape.opacity} className={shape.className} />;
}

function renderShape(shape: ChartShape, key: string): ReactElement | null {
  if (shape.kind === 'point') return renderMarker(shape, key);
  if (shape.kind === 'bar' || shape.kind === 'arc') {
    return <path key={key} d={shape.path} fill={shape.color} opacity={shape.opacity} className={shape.className} />;
  }
  return <path
    key={key}
    d={shape.path}
    fill={shape.fill ? shape.color : 'none'}
    stroke={shape.fill ? 'none' : shape.color}
    strokeWidth={shape.lineWidth}
    strokeDasharray={DASH_ARRAY[shape.dashStyle]}
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={shape.opacity}
    className={shape.className}
  />;
}

function pointRef(point: ChartPoint<unknown>): CgChartPointRef {
  return Object.freeze({ seriesName: point.seriesName, pointIndex: point.pointIndex });
}

function pointAttributes(
  point: ChartPoint<unknown>,
  percentage: string | undefined,
  selected: ReadonlySet<string>,
  activeKey: string | null,
  keyboard: boolean,
  pointLabel: string,
): Readonly<Record<string, string | number | boolean | undefined>> {
  const reference = pointRef(point);
  const key = pointRefKey(reference);
  return {
    'data-cg-chart-point': '',
    'data-cg-series-name': point.seriesName,
    'data-cg-point-index': point.pointIndex,
    'data-cg-argument': point.formattedArgument,
    'data-cg-value': point.formattedTooltipValue,
    'data-cg-tooltip-enabled': point.tooltipEnabled ? 'true' : 'false',
    'data-cg-percentage': percentage,
    'data-cg-selected': selected.has(key) ? 'true' : undefined,
    role: 'graphics-symbol',
    'aria-roledescription': pointLabel,
    'aria-label': chartMessage('{series}, {argument}, {value}', {
      series: point.seriesName,
      argument: point.formattedArgument,
      value: point.formattedValue,
    }),
    tabIndex: keyboard && key === activeKey ? 0 : -1,
  };
}

function renderHitTarget(
  target: ChartHitTarget,
  index: number,
  selected: ReadonlySet<string>,
  activeKey: string | null,
  keyboard: boolean,
  pointRoleDescription: string,
): ReactElement {
  const attributes = pointAttributes(target.point, target.percentage, selected, activeKey, keyboard, pointRoleDescription);
  const key = `hit-${target.point.seriesName}-${target.point.pointIndex}-${index}`;
  if (target.path) return <path key={key} d={target.path} fill="transparent" stroke="transparent" {...attributes} />;
  if (target.bounds) return <rect key={key} {...target.bounds} fill="transparent" {...attributes} />;
  return <circle key={key} cx={target.x} cy={target.y} r={target.radius ?? 10} fill="transparent" stroke="transparent" {...attributes} />;
}

function seriesForShape<TItem>(series: ChartSeries<TItem>, shape: ChartShape): boolean {
  return shape.seriesName === series.name;
}

function frozenNames(names: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...names]);
}

function sameNames(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}

function renderTable(
  mode: NonNullable<CgChartProps<unknown>['dataTableMode']>,
  caption: string,
  toggle: string,
  argumentHeader: string,
  percentageHeader: string,
  table: ReturnType<typeof projectChartTable>,
): ReactNode {
  if (mode === 'hidden' || !table.rows.length) return null;
  const content = <table className={styles.table}>
    <caption>{caption}</caption>
    <thead><tr>
      <th scope="col">{argumentHeader}</th>
      {table.seriesNames.map((name) => <th key={name} scope="col">{name}</th>)}
      {table.pie && table.rows.some((row) => row.percentage) ? <th scope="col">{percentageHeader}</th> : null}
    </tr></thead>
    <tbody>{table.rows.map((row, rowIndex) => <tr key={`${row.argument}-${rowIndex}`}>
      <th scope="row">{row.argument}</th>
      {row.cells.map((cell) => <td key={cell.seriesName}>{cell.text}</td>)}
      {table.pie && table.rows.some((candidate) => candidate.percentage) ? <td>{row.percentage ?? ''}</td> : null}
    </tr>)}</tbody>
  </table>;
  if (mode === 'collapsed') return <details className={styles.tableDetails}><summary>{toggle}</summary>{content}</details>;
  return <div className={mode === 'visuallyHidden' ? styles.visuallyHidden : styles.tableWrap}>{content}</div>;
}

function activePointKey(
  active: CgChartPointRef | null,
  hits: ReadonlyArray<ChartHitTarget>,
): string | null {
  const available = new Set(hits.map((target) => pointRefKey(pointRef(target.point))));
  if (active && available.has(pointRefKey(active))) return pointRefKey(active);
  const first = hits[0]?.point;
  return first ? pointRefKey(pointRef(first)) : null;
}

function selectedSet(selection: ReadonlyArray<CgChartPointRef>): ReadonlySet<string> {
  return new Set(selection.map(pointRefKey));
}

function shapeSwatch(series: ChartSeries<unknown>): ReactNode {
  return <svg className={styles.legendSwatch} viewBox="0 0 28 14" aria-hidden="true">
    <path d="M2 7H26" fill="none" stroke={series.color} strokeWidth="2" strokeDasharray={DASH_ARRAY[series.dashStyle]} />
    {series.markerSymbol === 'circle'
      ? <circle cx="14" cy="7" r="3.5" fill={series.color} />
      : <path d={markerPath(series.markerSymbol, 14, 7, 7)} fill={series.markerSymbol === 'cross' ? 'none' : series.color} stroke={series.color} strokeWidth="1.5" />}
  </svg>;
}

export function CgChart<TItem>(props: CgChartProps<TItem>): ReactElement {
  const {
    data,
    series,
    argumentAxis,
    valueAxes,
    constantLines,
    annotations,
    legend,
    tooltip,
    pointLabels,
    renderEmpty,
    renderLoading,
    title,
    subtitle,
    description,
    ariaLabel,
    width = '100%',
    height = '350px',
    aspectRatio,
    fallbackWidth = 640,
    fallbackHeight = 320,
    orientation = 'vertical',
    palette,
    selectionMode = 'none',
    selectedPoints,
    defaultSelectedPoints = [],
    onSelectedPointsChange,
    onSelectionChanged,
    visibleSeriesNames,
    defaultVisibleSeriesNames,
    onVisibleSeriesNamesChange,
    dataTableMode = 'collapsed',
    enableKeyboardNavigation = true,
    animation = 'none',
    loading = false,
    maxPointsPerSeries = 5_000,
    customizePoint,
    onPointActivate,
    onLegendItemClick,
    locale = 'en-US',
    displayTimeZone = 'UTC',
    strings: stringOverrides,
    direction = 'auto',
    actionsRef,
    className,
    style,
    dir: rootDirection,
    ...rootAttributes
  } = props;

  validateChartConfiguration(props);
  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<ChartBrowserController | null>(null);
  const activeRef = useRef<CgChartPointRef | null>(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(1);
  const activationGenerationRef = useRef(1);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [dimensions, setDimensions] = useState(() => Object.freeze({ width: fallbackWidth, height: fallbackHeight }));
  const [uncontrolledSelection, setUncontrolledSelection] = useState(() => normalizePointRefs(defaultSelectedPoints));
  const [uncontrolledVisible, setUncontrolledVisible] = useState(() => initialVisibleSeriesNames(series, defaultVisibleSeriesNames));
  const [announcement, setAnnouncement] = useState('');
  const pendingSelectionRef = useRef<CgChartSelectionChangeDetail | null>(null);
  const pendingVisibilityRef = useRef<Readonly<{ names: ReadonlyArray<string>; seriesName: string; visible: boolean }> | null>(null);
  const previousAcceptedSelectionRef = useRef<ReadonlyArray<CgChartPointRef>>(normalizePointRefs(selectedPoints ?? defaultSelectedPoints));
  const previousAcceptedVisibleRef = useRef<ReadonlyArray<string>>(initialVisibleSeriesNames(series, visibleSeriesNames ?? defaultVisibleSeriesNames));
  const previousSeriesNamesRef = useRef<ReadonlySet<string>>(new Set(series.map((descriptor) => descriptor.name)));

  const explicitDirection = direction === 'auto' && (rootDirection === 'ltr' || rootDirection === 'rtl') ? rootDirection : direction;
  const resolvedDirection = useDirection(rootRef, explicitDirection);
  const rtl = resolvedDirection === 'rtl';
  const resolvedStrings = useMemo(() => resolveChartStrings(stringOverrides), [stringOverrides]);
  const formatter = useMemo(
    () => createChartFormatter(locale, displayTimeZone, resolvedStrings),
    [displayTimeZone, locale, resolvedStrings],
  );

  const chartPropsForModel = useMemo<CgChartProps<TItem>>(() => ({
    data, series, argumentAxis, valueAxes, constantLines, annotations, pointLabels, tooltip, legend,
    palette, maxPointsPerSeries, customizePoint, locale, displayTimeZone,
  }), [
    annotations, argumentAxis, constantLines, customizePoint, data, displayTimeZone, legend, locale,
    maxPointsPerSeries, palette, pointLabels, series, tooltip, valueAxes,
  ]);
  const sourceModel = useMemo(
    () => {
      void refreshRevision;
      return buildChartSourceModel(chartPropsForModel, formatter);
    },
    [chartPropsForModel, formatter, refreshRevision],
  );
  const acceptedSelection = useMemo(
    () => selectedPoints === undefined ? uncontrolledSelection : normalizePointRefs(selectedPoints),
    [selectedPoints, uncontrolledSelection],
  );
  const acceptedVisible = useMemo(
    () => visibleSeriesNames === undefined
      ? normalizeVisibleSeriesNames(series, uncontrolledVisible)
      : normalizeVisibleSeriesNames(series, visibleSeriesNames),
    [series, uncontrolledVisible, visibleSeriesNames],
  );
  const visibleSet = useMemo(() => new Set(acceptedVisible), [acceptedVisible]);
  const visibleModel = useMemo(() => projectVisibleModel(sourceModel, visibleSet), [sourceModel, visibleSet]);
  const layout = useMemo(() => buildChartLayout({
    model: visibleModel,
    width: dimensions.width,
    height: dimensions.height,
    orientation,
    rtl,
    formatter,
    argumentAxis,
    valueAxes,
    constantLines,
    annotations,
    pointLabels,
  }), [
    annotations, argumentAxis, constantLines, dimensions.height, dimensions.width, formatter, orientation,
    pointLabels, rtl, valueAxes, visibleModel,
  ]);
  const table = useMemo(() => projectChartTable(visibleModel, formatter), [formatter, visibleModel]);
  const selectionKeys = useMemo(() => selectedSet(acceptedSelection), [acceptedSelection]);
  const activeKey = activePointKey(activeRef.current, layout.hitTargets);

  const selectionRef = useRef(acceptedSelection);
  selectionRef.current = acceptedSelection;
  const visibleRef = useRef(acceptedVisible);
  visibleRef.current = acceptedVisible;
  const sourceRef = useRef(sourceModel);
  sourceRef.current = sourceModel;
  const propsRef = useRef({ selectionMode, onSelectedPointsChange, onSelectionChanged, onPointActivate });
  propsRef.current = { selectionMode, onSelectedPointsChange, onSelectionChanged, onPointActivate };

  useEffect(() => {
    activationGenerationRef.current += 1;
  }, [acceptedVisible, sourceModel]);

  const announceSelection = useCallback((detail: CgChartSelectionChangeDetail) => {
    const selected = detail.selectedPoints.at(-1);
    if (!selected) { setAnnouncement(resolvedStrings.selectionCleared); return; }
    const point = pointByRef(sourceRef.current, selected);
    if (!point) return;
    setAnnouncement(chartMessage(resolvedStrings.pointSelectedTemplate, {
      series: selected.seriesName,
      argument: point.formattedArgument,
      value: point.formattedValue,
    }));
  }, [resolvedStrings.pointSelectedTemplate, resolvedStrings.selectionCleared]);

  const proposeSelection = useStableCallback((
    next: ReadonlyArray<CgChartPointRef>,
    reason: CgChartSelectionChangeDetail['reason'],
  ): boolean => {
    const previous = selectionRef.current;
    const normalized = normalizePointRefs(next);
    if (samePointRefs(previous, normalized)) return false;
    const detail = selectionDetail(normalized, previous, reason);
    pendingSelectionRef.current = detail;
    propsRef.current.onSelectedPointsChange?.(normalized, detail);
    if (selectedPoints === undefined) setUncontrolledSelection(normalized);
    return true;
  });

  useEffect(() => {
    const previous = previousAcceptedSelectionRef.current;
    if (samePointRefs(previous, acceptedSelection)) return;
    previousAcceptedSelectionRef.current = acceptedSelection;
    const pending = pendingSelectionRef.current;
    if (pending && samePointRefs(pending.selectedPoints, acceptedSelection)) {
      const acceptedDetail = selectionDetail(acceptedSelection, pending.previousSelectedPoints, pending.reason);
      pendingSelectionRef.current = null;
      propsRef.current.onSelectionChanged?.(acceptedDetail);
      announceSelection(acceptedDetail);
    }
  }, [acceptedSelection, announceSelection]);

  useEffect(() => {
    if (sameNames(previousAcceptedVisibleRef.current, acceptedVisible)) return;
    previousAcceptedVisibleRef.current = acceptedVisible;
    const pending = pendingVisibilityRef.current;
    if (!pending || !sameNames(pending.names, acceptedVisible)) return;
    pendingVisibilityRef.current = null;
    setAnnouncement(chartMessage(
      pending.visible ? resolvedStrings.seriesShownTemplate : resolvedStrings.seriesHiddenTemplate,
      { series: pending.seriesName },
    ));
  }, [acceptedVisible, resolvedStrings.seriesHiddenTemplate, resolvedStrings.seriesShownTemplate]);

  useEffect(() => {
    const names = new Set(series.map((descriptor) => descriptor.name));
    const previousNames = previousSeriesNamesRef.current;
    setUncontrolledVisible((current) => {
      const retained = current.filter((name) => names.has(name));
      for (const descriptor of series) {
        if (!previousNames.has(descriptor.name) && descriptor.initialVisible !== false) retained.push(descriptor.name);
      }
      const normalized = frozenNames(retained);
      return current.length === normalized.length && current.every((value, index) => value === normalized[index]) ? current : normalized;
    });
    previousSeriesNamesRef.current = names;
  }, [series]);

  const setSeriesVisible = useStableCallback((seriesName: string, visible: boolean): boolean => {
    const descriptor = series.find((candidate) => candidate.name === seriesName);
    if (!descriptor) return false;
    const current = visibleRef.current;
    const isVisible = current.includes(seriesName);
    if (isVisible === visible) return false;
    if (!visible && (legend?.keepOneSeriesVisible ?? true) && sourceModel.kind === 'cartesian' && current.length <= 1) return false;
    const next = normalizeVisibleSeriesNames(series, visible ? [...current, seriesName] : current.filter((name) => name !== seriesName));
    const pending = Object.freeze({ names: next, seriesName, visible });
    pendingVisibilityRef.current = pending;
    onVisibleSeriesNamesChange?.(next);
    if (visibleSeriesNames === undefined) setUncontrolledVisible(next);
    return true;
  });

  const activatePoint = useStableCallback((reference: CgChartPointRef, ctrlKey: boolean, shiftKey: boolean) => {
    const point = pointByRef(sourceRef.current, reference);
    if (!point || point.synthetic || point.dataItem === null) return;
    const current = selectionRef.current;
    const proposed = proposePointSelection(propsRef.current.selectionMode, current, reference, ctrlKey || shiftKey);
    proposeSelection(proposed, 'activation');
    const generation = activationGenerationRef.current;
    window.setTimeout(() => {
      if (!mountedRef.current || generation !== activationGenerationRef.current) return;
      const accepted = selectionRef.current.some((candidate) => pointRefKey(candidate) === pointRefKey(reference));
      const detail = Object.freeze<CgChartPointEventDetail<TItem>>({
        seriesName: reference.seriesName,
        pointIndex: reference.pointIndex,
        argument: point.originalArgument,
        value: point.originalValue,
        formattedArgument: point.formattedArgument,
        formattedValue: point.formattedValue,
        dataItem: point.dataItem!,
        ctrlKey,
        shiftKey,
        isSelected: accepted,
      });
      propsRef.current.onPointActivate?.(detail);
    }, 0);
  });

  const onActivePoint = useStableCallback((reference: CgChartPointRef | null) => {
    activeRef.current = reference;
  });

  useEffect(() => {
    mountedRef.current = true;
    const root = rootRef.current;
    if (!root) return undefined;
    const controller = registerChartBrowser(root, {
      tooltip: tooltip?.enabled !== false,
      keyboard: enableKeyboardNavigation,
      rtl,
      onActivePoint,
      onActivate: activatePoint,
    });
    browserRef.current = controller;
    return () => {
      generationRef.current += 1;
      activationGenerationRef.current += 1;
      mountedRef.current = false;
      controller.dispose();
      if (browserRef.current === controller) browserRef.current = null;
    };
  }, [activatePoint, enableKeyboardNavigation, onActivePoint, rtl, tooltip?.enabled]);

  useEffect(() => {
    const first = layout.hitTargets[0]?.point;
    const currentKey = activeRef.current ? pointRefKey(activeRef.current) : null;
    const available = new Set(layout.hitTargets.map((target) => pointRefKey(pointRef(target.point))));
    if (!currentKey || !available.has(currentKey)) activeRef.current = first ? pointRef(first) : null;
  }, [layout.hitTargets]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === 'undefined') return undefined;
    const generation = generationRef.current;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!mountedRef.current || generation !== generationRef.current || !surface.isConnected) return;
      const nextWidth = Math.floor(surface.clientWidth / 16) * 16;
      const nextHeight = Math.floor(surface.clientHeight / 16) * 16;
      if (nextWidth <= 0 || nextHeight <= 0) return;
      setDimensions((current) => current.width === nextWidth && current.height === nextHeight
        ? current : Object.freeze({ width: nextWidth, height: nextHeight }));
    };
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestBrowserFrame(measure);
    });
    observer.observe(surface);
    frame = requestBrowserFrame(measure);
    return () => {
      observer.disconnect();
      if (frame) cancelBrowserFrame(frame);
    };
  }, []);

  const actions = useMemo<CgChartActions>(() => Object.freeze({
    focus: () => browserRef.current?.focus(activeRef.current) ?? false,
    refresh: () => setRefreshRevision((revision) => revision + 1),
    getSvg: () => rootRef.current ? serializeChartSvg(rootRef.current) : null,
    exportSvg: (fileName?: string) => rootRef.current ? downloadChartSvg(rootRef.current, fileName) : false,
    setSeriesVisible,
    selectPoints: (points: ReadonlyArray<CgChartPointRef>) => proposeSelection(points, 'action'),
    resetSelection: () => proposeSelection([], 'action'),
    getActivePoint: () => activeRef.current ? Object.freeze({ ...activeRef.current }) : null,
  }), [proposeSelection, setSeriesVisible]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  const titleId = `${useId()}-title`;
  const descriptionId = `${useId()}-description`;
  const instructionsId = `${useId()}-instructions`;
  const describedBy = [description ? descriptionId : null, enableKeyboardNavigation && !layout.isEmpty ? instructionsId : null].filter(Boolean).join(' ') || undefined;
  const rootStyle = {
    ...style,
    '--cg-chart-width': typeof width === 'number' ? `${width}px` : width,
    '--cg-chart-height': typeof height === 'number' ? `${height}px` : height,
    ...(aspectRatio ? { '--cg-chart-aspect-ratio': String(aspectRatio) } : {}),
  } as CSSProperties;
  const legendPosition = legend?.visible === false ? 'none' : legend?.position ?? 'bottom';
  const legendBefore = legendPosition === 'top' || legendPosition === 'start';

  const activateLegendSeries = (descriptor: CgChartSeriesDescriptor<TItem>) => {
    const visible = acceptedVisible.includes(descriptor.name);
    const changed = (legend?.mode ?? 'toggle') === 'toggle' ? setSeriesVisible(descriptor.name, !visible) : false;
    onLegendItemClick?.(Object.freeze({ seriesName: descriptor.name, visible: changed ? !visible : visible }));
  };

  const renderLegendItem = (seriesModel: ChartSeries<TItem>): ReactNode => {
    const visible = acceptedVisible.includes(seriesModel.name);
    const activate = () => activateLegendSeries(seriesModel.descriptor);
    const defaultContent = <>{shapeSwatch(seriesModel as ChartSeries<unknown>)}<span>{seriesModel.name}</span></>;
    const context = Object.freeze<CgChartLegendItemRenderContext>({
      seriesName: seriesModel.name,
      label: seriesModel.name,
      visible,
      color: seriesModel.color,
      markerSymbol: seriesModel.markerSymbol,
      dashStyle: seriesModel.dashStyle,
      defaultContent,
      activate,
    });
    const content = legend?.renderItem?.(context) ?? defaultContent;
    return (legend?.mode ?? 'toggle') === 'static'
      ? <span key={seriesModel.name} className={styles.legendItem}>{content}</span>
      : <button key={seriesModel.name} type="button" className={styles.legendButton} aria-pressed={visible} onClick={activate}>{content}</button>;
  };

  const pieSeries = sourceModel.kind === 'pie' ? sourceModel.series[0] : undefined;
  const renderPieLegend = () => pieSeries?.points.map((point) => {
    const color = point.color ?? `var(--cg-chart-series-${point.pointIndex % 10 + 1})`;
    const activate = () => {
      activatePoint(pointRef(point), false, false);
      onLegendItemClick?.(Object.freeze({ seriesName: pieSeries.name, visible: true, pointIndex: point.pointIndex }));
    };
    const defaultContent = <><span className={styles.legendPieSwatch} style={{ background: color }} aria-hidden="true" /><span>{point.formattedArgument}</span></>;
    const context = Object.freeze<CgChartLegendItemRenderContext>({
      seriesName: pieSeries.name, pointIndex: point.pointIndex, label: point.formattedArgument,
      visible: true, color, markerSymbol: pieSeries.markerSymbol, dashStyle: pieSeries.dashStyle,
      defaultContent, activate,
    });
    return <button key={`${pieSeries.name}-${point.pointIndex}`} type="button" className={styles.legendButton} aria-pressed="true" onClick={activate}>
      {legend?.renderItem?.(context) ?? defaultContent}
    </button>;
  });

  const legendNode = legendPosition !== 'none' && sourceModel.series.some((candidate) => candidate.descriptor.showInLegend !== false)
    ? <div
        className={cx(styles.legend, styles[`legend${legendPosition[0]!.toUpperCase()}${legendPosition.slice(1)}`])}
        aria-label={resolvedStrings.legendAriaLabel}
        data-orientation={legend?.orientation ?? 'auto'}
      >{sourceModel.kind === 'pie'
        ? renderPieLegend()
        : sourceModel.series.filter((candidate) => candidate.descriptor.showInLegend !== false).map(renderLegendItem)}</div>
    : null;

  const canvas = <svg
    className={cx(styles.canvas, animation === 'onLoad' && styles.animate)}
    width={layout.width}
    height={layout.height}
    viewBox={`0 0 ${svgNumber(layout.width)} ${svgNumber(layout.height)}`}
    preserveAspectRatio="xMidYMid meet"
    role={enableKeyboardNavigation ? 'presentation' : 'img'}
    aria-label={enableKeyboardNavigation ? undefined : `${title ?? ariaLabel ?? resolvedStrings.chartAriaLabel}${description ? `. ${description}` : ''}`}
    focusable="false"
    data-cg-chart-canvas=""
  >
    <title>{title ?? ariaLabel ?? resolvedStrings.chartAriaLabel}</title>
    {description ? <desc>{description}</desc> : null}
    <g className={styles.grid} aria-hidden="true">
      {layout.valueAxes.flatMap((axis) => axis.showGridLines ? axis.ticks.map((tick, index) => orientation === 'vertical'
        ? <line key={`${axis.name}-grid-${index}`} x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={tick.position} y2={tick.position} data-visible="true" />
        : <line key={`${axis.name}-grid-${index}`} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} x1={tick.position} x2={tick.position} data-visible="true" />) : [])}
      {sourceModel.kind === 'cartesian' && argumentAxis?.visible !== false && argumentAxis?.showGridLines ? layout.argumentTicks.map((tick, index) => orientation === 'vertical'
        ? <line key={`arg-grid-${index}`} x1={tick.position} x2={tick.position} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} data-visible="true" />
        : <line key={`arg-grid-${index}`} x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={tick.position} y2={tick.position} data-visible="true" />) : null}
    </g>
    <g className={styles.zeroLines} aria-hidden="true">
      {layout.valueAxes.map((axis) => axis.showZeroLine && axis.zeroPosition !== null
        ? orientation === 'vertical'
          ? <line key={axis.name} x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={axis.zeroPosition} y2={axis.zeroPosition} />
          : <line key={axis.name} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} x1={axis.zeroPosition} x2={axis.zeroPosition} />
        : null)}
    </g>
    <g className={styles.axes} aria-hidden="true">
      {sourceModel.kind === 'cartesian' && argumentAxis?.visible !== false ? <g>
        {(argumentAxis?.showAxisLine ?? true) ? orientation === 'vertical'
          ? <line x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={layout.plot.y + layout.plot.height} y2={layout.plot.y + layout.plot.height} />
          : <line x1={rtl ? layout.plot.x + layout.plot.width : layout.plot.x} x2={rtl ? layout.plot.x + layout.plot.width : layout.plot.x} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} /> : null}
        {(argumentAxis?.showTickMarks ?? true) ? layout.argumentTicks.map((tick, index) => orientation === 'vertical'
          ? <line key={`arg-mark-${index}`} x1={tick.position} x2={tick.position} y1={layout.plot.y + layout.plot.height} y2={layout.plot.y + layout.plot.height + 5} />
          : <line key={`arg-mark-${index}`} x1={rtl ? layout.plot.x + layout.plot.width - 5 : layout.plot.x} x2={rtl ? layout.plot.x + layout.plot.width : layout.plot.x + 5} y1={tick.position} y2={tick.position} />) : null}
        {layout.argumentTicks.map((tick, index) => orientation === 'vertical'
          ? <text key={`arg-${index}`} x={tick.position} y={layout.plot.y + layout.plot.height + 22 + (tick.row ?? 0) * 16} transform={tick.rotation ? `rotate(${tick.rotation} ${tick.position} ${layout.plot.y + layout.plot.height + 22})` : undefined} textAnchor={tick.rotation ? 'end' : 'middle'}><title>{tick.fullText}</title>{tick.text}</text>
          : <text key={`arg-${index}`} x={rtl ? layout.plot.x + layout.plot.width + 8 : layout.plot.x - 8} y={tick.position + 4} textAnchor={rtl ? 'start' : 'end'}><title>{tick.fullText}</title>{tick.text}</text>)}
        {argumentAxis?.title ? orientation === 'vertical'
          ? <text className={styles.axisTitle} x={layout.plot.x + layout.plot.width / 2} y={layout.plot.y + layout.plot.height + Math.max(44, layout.argumentLabelPlan.thickness + 24)} textAnchor="middle">{argumentAxis.title}</text>
          : <text className={styles.axisTitle} x={rtl ? layout.plot.x + layout.plot.width + 34 : layout.plot.x - 34} y={layout.plot.y + layout.plot.height / 2} textAnchor="middle" transform={`rotate(${rtl ? 90 : -90} ${rtl ? layout.plot.x + layout.plot.width + 34 : layout.plot.x - 34} ${layout.plot.y + layout.plot.height / 2})`}>{argumentAxis.title}</text>
          : null}
      </g> : null}
      {layout.valueAxes.map((axis) => {
        const physicalStart = orientation === 'vertical' ? axis.position === (rtl ? 'end' : 'start') : axis.position === 'start';
        const coordinate = orientation === 'vertical'
          ? physicalStart ? layout.plot.x - axis.offset : layout.plot.x + layout.plot.width + axis.offset
          : physicalStart ? layout.plot.y - axis.offset : layout.plot.y + layout.plot.height + axis.offset;
        return <g key={axis.name}>
          {axis.showAxisLine ? orientation === 'vertical'
            ? <line x1={coordinate} x2={coordinate} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} />
            : <line x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={coordinate} y2={coordinate} /> : null}
          {axis.ticks.map((tick, tickIndex) => orientation === 'vertical'
            ? <text key={tickIndex} x={physicalStart ? coordinate - 8 : coordinate + 8} y={tick.position + 4} textAnchor={physicalStart ? 'end' : 'start'}>{tick.text}</text>
            : <text key={tickIndex} x={tick.position} y={physicalStart ? coordinate - 8 : coordinate + 20} textAnchor="middle">{tick.text}</text>)}
          {axis.title ? orientation === 'vertical'
            ? <text className={styles.axisTitle} x={physicalStart ? coordinate - axis.labelWidth - 18 : coordinate + axis.labelWidth + 18} y={layout.plot.y + layout.plot.height / 2} textAnchor="middle" transform={`rotate(${physicalStart ? -90 : 90} ${physicalStart ? coordinate - axis.labelWidth - 18 : coordinate + axis.labelWidth + 18} ${layout.plot.y + layout.plot.height / 2})`}>{axis.title}</text>
            : <text className={styles.axisTitle} x={layout.plot.x + layout.plot.width / 2} y={physicalStart ? coordinate - 24 : coordinate + 36} textAnchor="middle">{axis.title}</text>
            : null}
        </g>;
      })}
    </g>
    <g className={styles.seriesLayer}>
      {visibleModel.visibleSeries.map((seriesModel) => <g
        key={seriesModel.name}
        className={styles.series}
        data-cg-chart-series={seriesModel.name}
        role="group"
        aria-roledescription={resolvedStrings.seriesRoleDescription}
        aria-label={chartMessage(resolvedStrings.seriesLabelTemplate, {
          series: seriesModel.name,
          count: layout.hitTargets.filter((target) => target.point.seriesName === seriesModel.name).length,
        })}
      >{layout.shapes.filter((shape) => seriesForShape(seriesModel, shape)).map((shape, index) => renderShape(shape, `${seriesModel.name}-${shape.kind}-${index}`))}</g>)}
    </g>
    <g className={styles.constantLines} aria-hidden="true">
      {layout.constantLines.map((line, index) => <g key={index} className={line.className}>
        <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={line.color} strokeWidth={line.width} strokeDasharray={DASH_ARRAY[line.dashStyle]} />
        {line.label ? <text x={line.labelX} y={line.labelY} textAnchor={line.labelAnchor}>{line.label}</text> : null}
      </g>)}
    </g>
    <g className={styles.labels} aria-hidden="true">
      {layout.labels.map((label, index) => <g key={index}>
        {label.connector ? <line {...label.connector} /> : null}
        <text x={label.x} y={label.y} textAnchor={label.anchor}>{label.text}</text>
      </g>)}
    </g>
    <g className={styles.annotations} aria-hidden="true">
      {layout.annotations.map((annotation, index) => <text key={index} x={annotation.x} y={annotation.y} textAnchor="middle" className={annotation.className}>{annotation.text}</text>)}
    </g>
    <g className={styles.hits} data-cg-interactive-only="">
      {layout.hitTargets.map((target, index) => renderHitTarget(target, index, selectionKeys, activeKey, enableKeyboardNavigation, resolvedStrings.pointRoleDescription))}
    </g>
  </svg>;

  return <div
    {...rootAttributes}
    ref={rootRef}
    className={cx(styles.root, className)}
    style={rootStyle}
    dir={direction === 'auto' ? rootDirection : resolvedDirection}
    role="group"
    aria-roledescription="chart"
    aria-labelledby={titleId}
    aria-describedby={describedBy}
    aria-busy={loading || undefined}
    tabIndex={-1}
    data-cg-chart=""
    data-cg-direction={resolvedDirection}
    data-cg-chart-width={layout.width}
    data-cg-chart-height={layout.height}
  >
    {title ? <p id={titleId} className={styles.title}>{title}</p> : <span id={titleId} className={styles.visuallyHidden}>{ariaLabel ?? resolvedStrings.chartAriaLabel}</span>}
    {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
    {legendBefore ? legendNode : null}
    <div
      ref={surfaceRef}
      className={styles.surface}
      style={aspectRatio ? { aspectRatio } : undefined}
      data-cg-chart-surface=""
    >
      {loading
        ? <div className={styles.state} role="status" data-cg-chart-loading="">{renderLoading?.() ?? resolvedStrings.loading}</div>
        : layout.tooSmall
          ? <p className={styles.state} data-cg-chart-too-small="">{resolvedStrings.tooSmall}</p>
          : layout.isEmpty
            ? <div className={styles.state} role="status" data-cg-chart-empty="">{renderEmpty?.() ?? resolvedStrings.noData}</div>
            : canvas}
      <div className={styles.tooltip} data-cg-chart-tooltip="" role="tooltip" hidden aria-hidden="true">
        {tooltip?.showSeriesName !== false ? <span className={styles.tooltipSeries} data-cg-tooltip-series="" /> : null}
        <span data-cg-tooltip-argument="" />
        <span data-cg-tooltip-value="" />
      </div>
    </div>
    {!legendBefore ? legendNode : null}
    <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {enableKeyboardNavigation && !layout.isEmpty ? <span id={instructionsId} className={styles.visuallyHidden}>{resolvedStrings.keyboardInstructions}</span> : null}
    {renderTable(dataTableMode, title ?? resolvedStrings.dataTableSummary, resolvedStrings.dataTableToggle, resolvedStrings.argumentColumnHeader, resolvedStrings.percentageColumnHeader, table)}
  </div>;
}
