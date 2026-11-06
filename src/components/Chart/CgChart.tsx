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
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { useDirection, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import type {
  CgChartActions,
  CgChartAxisRef,
  CgChartElementRef,
  CgChartLegendItemRenderContext,
  CgChartPointEventDetail,
  CgChartPointRef,
  CgChartProps,
  CgChartSelectionChangeDetail,
  CgChartSeriesDescriptor,
  CgChartStrokeStyle,
} from './CgChart.types';
import { resolveDocumentStyle } from './chartAppearance';
import type { ChartDocumentStyle } from './chartAppearance';
import type {
  ChartDocumentAxis,
  ChartDocumentGrid,
  ChartLayout,
  ChartLegendEntryLayout,
  ChartLineSegment,
  ChartTextItem,
} from './chartLayoutTypes';
import { selectionGeometry } from './chartSelection';
import { createTextMeasurer, dashArray } from './chartText';
import type { ChartStroke } from './chartText';
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
import { rectPath, svgNumber } from './chartPaths';
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
  const fill = shape.fillColor ?? shape.color;
  if (shape.markerSymbol === 'circle' || shape.markerSymbol === 'auto') {
    return <circle key={key} cx={shape.x} cy={shape.y} r={shape.markerSize / 2} fill={fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} className={shape.className} />;
  }
  const path = markerPath(shape.markerSymbol, shape.x, shape.y, shape.markerSize);
  const cross = shape.markerSymbol === 'cross';
  return <path key={key} d={path} fill={cross ? 'none' : fill} stroke={shape.stroke ?? shape.color} strokeWidth={shape.strokeWidth ?? (cross ? 2 : 1)} opacity={shape.opacity} className={shape.className} />;
}

function renderShape(shape: ChartShape, key: string): ReactElement | null {
  if (shape.kind === 'point') return renderMarker(shape, key);
  if (shape.kind === 'bar' || shape.kind === 'arc') {
    return <path key={key} d={shape.path} fill={shape.color} stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeDasharray={shape.dashArray} strokeLinejoin={shape.stroke ? 'round' : undefined} opacity={shape.opacity} className={shape.className} />;
  }
  return <path
    key={key}
    d={shape.path}
    fill={shape.fill ? shape.color : 'none'}
    stroke={shape.fill ? 'none' : shape.color}
    strokeWidth={shape.lineWidth}
    strokeDasharray={shape.dashArray}
    strokeLinecap={shape.lineCap ?? 'round'}
    strokeLinejoin="round"
    opacity={shape.opacity}
    className={shape.className}
  />;
}

/** Physical anchors (`start` is left) mapped onto SVG anchors, which follow the text direction. */
function svgAnchor(anchor: ChartTextItem['anchor'], rtl: boolean): 'start' | 'middle' | 'end' {
  if (anchor === 'middle' || !rtl) return anchor;
  return anchor === 'start' ? 'end' : 'start';
}

function renderText(item: ChartTextItem, key: string, rtl: boolean): ReactElement {
  return <text
    key={key}
    x={item.x}
    y={item.y}
    textAnchor={svgAnchor(item.anchor, rtl)}
    fill={item.style.color}
    fontSize={item.style.size}
    fontFamily={item.style.family}
    fontWeight={item.style.bold ? 700 : undefined}
    fontStyle={item.style.italic ? 'italic' : undefined}
    transform={item.rotation ? `rotate(${svgNumber(item.rotation)} ${svgNumber(item.pivotX ?? item.x)} ${svgNumber(item.pivotY ?? item.y)})` : undefined}
  >{item.fullText && item.fullText !== item.text ? <title>{item.fullText}</title> : null}{item.text}</text>;
}

function strokeAttributes(stroke: ChartStroke | null): Readonly<Record<string, string | number | undefined>> {
  if (!stroke) return { stroke: 'none' };
  return {
    stroke: stroke.color,
    strokeWidth: stroke.width,
    strokeDasharray: dashArray(stroke.dashStyle, stroke.width, true),
    strokeLinecap: stroke.dashStyle === 'dot' ? 'round' : 'butt',
  };
}

function renderSegments(lines: ReadonlyArray<ChartLineSegment>, key: string, stroke: ChartStroke | null): ReactElement | null {
  if (!lines.length || !stroke) return null;
  const d = lines.map((line) => `M${svgNumber(line.x1)} ${svgNumber(line.y1)}L${svgNumber(line.x2)} ${svgNumber(line.y2)}`).join('');
  return <path key={key} d={d} fill="none" {...strokeAttributes(stroke)} shapeRendering="crispEdges" />;
}

function axisDataAttributes(ref: CgChartAxisRef): Readonly<Record<string, string>> {
  return ref.axis === 'argument'
    ? { 'data-cg-axis': 'argument' }
    : { 'data-cg-axis': 'value', 'data-cg-axis-name': ref.axisName };
}

function renderGrid(grid: ChartDocumentGrid, index: number): ReactElement {
  const d = grid.lines.map((line) => `M${svgNumber(line.x1)} ${svgNumber(line.y1)}L${svgNumber(line.x2)} ${svgNumber(line.y2)}`).join('');
  return <g key={`grid-${index}`} data-cg-element={grid.kind === 'major' ? 'majorGridLines' : 'minorGridLines'} {...axisDataAttributes(grid.ref)}>
    <path d={d} fill="none" {...strokeAttributes(grid.stroke)} shapeRendering="crispEdges" />
    <path d={d} fill="none" stroke="transparent" strokeWidth={6} className={styles.hitStroke} />
  </g>;
}

function renderDocumentAxis(axis: ChartDocumentAxis, index: number, rtl: boolean): ReactElement {
  return <g key={`axis-${index}`}>
    <g data-cg-element="axis" {...axisDataAttributes(axis.ref)}>
      {axis.box ? <rect {...axis.box} className={styles.hitBox} /> : null}
      {axis.line ? renderSegments([axis.line], 'line', axis.lineStroke) : null}
      {renderSegments(axis.tickMarks, 'major', axis.tickStroke)}
      {renderSegments(axis.minorTickMarks, 'minor', axis.tickStroke)}
      {axis.labels.map((label, labelIndex) => renderText(label, `label-${labelIndex}`, rtl))}
    </g>
    {axis.title ? <g data-cg-element="axisTitle" {...axisDataAttributes(axis.ref)}>
      <rect {...axis.title.box} className={styles.hitBox} />
      {renderText(axis.title.item, 'title', rtl)}
    </g> : null}
  </g>;
}

function renderLegendEntry(entry: ChartLegendEntryLayout, index: number, rtl: boolean): ReactElement {
  const key = entry.key;
  const centerX = key.x + key.width / 2;
  const centerY = key.y + key.height / 2;
  let swatch: ReactNode;
  if (key.kind === 'rect') {
    swatch = <rect x={key.x} y={key.y} width={key.width} height={key.height} fill={key.color} opacity={key.opacity} stroke={key.stroke} strokeWidth={key.strokeWidth} />;
  } else {
    const symbol = key.markerSymbol;
    const size = key.markerSize ?? 0;
    swatch = <>
      {key.showLine !== false ? <line x1={key.x} x2={key.x + key.width} y1={centerY} y2={centerY} stroke={key.color} strokeWidth={key.strokeWidth ?? 2} strokeDasharray={key.dashArray} /> : null}
      {symbol && symbol !== 'none' && size > 0
        ? symbol === 'circle' || symbol === 'auto'
          ? <circle cx={centerX} cy={centerY} r={size / 2} fill={key.markerFill} stroke={key.markerStroke} strokeWidth={key.markerStrokeWidth} />
          : <path d={markerPath(symbol, centerX, centerY, size)} fill={symbol === 'cross' ? 'none' : key.markerFill} stroke={key.markerStroke ?? key.markerFill} strokeWidth={key.markerStrokeWidth ?? (symbol === 'cross' ? 2 : 1)} />
        : null}
    </>;
  }
  return <g
    key={`legend-${index}`}
    data-cg-element="legendEntry"
    data-cg-series-name={entry.seriesName}
    data-cg-point-index={entry.pointIndex}
  >
    <rect {...entry.box} className={styles.hitBox} />
    {swatch}
    {renderText(entry.text, 'text', rtl)}
  </g>;
}

function boxAttributes(fill: string | null, stroke: ChartStroke | null, radius = 0): Readonly<Record<string, string | number | undefined>> {
  return {
    fill: fill ?? 'transparent',
    ...strokeAttributes(stroke),
    ...(radius > 0 ? { rx: radius, ry: radius } : {}),
  };
}

function renderDocumentBackground(layout: ChartLayout, style: ChartDocumentStyle): ReactNode {
  const document = layout.document;
  if (!document) return null;
  const inset = (style.chartBorder?.width ?? 0) / 2;
  return <>
    <g data-cg-element="chartArea">
      <rect x={inset} y={inset} width={Math.max(0, layout.width - inset * 2)} height={Math.max(0, layout.height - inset * 2)} {...boxAttributes(style.chartFill, style.chartBorder, style.cornerRadius)} />
    </g>
    <g data-cg-element="plotArea">
      <rect {...layout.plot} {...boxAttributes(style.plotFill, style.plotBorder)} />
    </g>
  </>;
}

function renderSelection(layout: ChartLayout, element: CgChartElementRef | null | undefined, color: string): ReactNode {
  const geometry = selectionGeometry(layout, element);
  if (!geometry.rectangles.length && !geometry.handles.length) return null;
  const handle = 5;
  return <g className={styles.selection} aria-hidden="true" data-cg-chart-selection="">
    {geometry.rectangles.length ? <path d={geometry.rectangles.map((rectangle) => rectPath(rectangle.x, rectangle.y, rectangle.width, rectangle.height)).join('')} fill="none" stroke={color} strokeWidth={1} /> : null}
    {geometry.handles.length ? <path
      d={geometry.handles.map((point) => rectPath(point.x - handle / 2, point.y - handle / 2, handle, handle)).join('')}
      fill="#fff"
      stroke={color}
      strokeWidth={1}
    /> : null}
  </g>;
}

/** Inline style for a dashboard gridline, so it wins over the stylesheet's gridline colour. */
function gridLineStyle(stroke: CgChartStrokeStyle | undefined): CSSProperties | undefined {
  if (!stroke) return undefined;
  const width = stroke.width ?? 1;
  return {
    ...(stroke.color ? { stroke: stroke.color === 'none' ? 'transparent' : stroke.color } : {}),
    ...(stroke.width !== undefined ? { strokeWidth: stroke.width } : {}),
    ...(stroke.dashStyle ? { strokeDasharray: dashArray(stroke.dashStyle, width, true) ?? 'none' } : {}),
  };
}

function readElement(target: EventTarget | null): CgChartElementRef | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement | SVGElement>('[data-cg-element],[data-cg-chart-point]');
  if (!element) return null;
  const data = element.dataset;
  const seriesName = data.cgSeriesName;
  const pointIndex = data.cgPointIndex === undefined ? undefined : Number(data.cgPointIndex);
  const axis: CgChartAxisRef | null = data.cgAxis === 'argument'
    ? { axis: 'argument' }
    : data.cgAxis === 'value' && data.cgAxisName ? { axis: 'value', axisName: data.cgAxisName } : null;
  if (element.hasAttribute('data-cg-chart-point') && seriesName && pointIndex !== undefined) {
    return Object.freeze({ kind: 'point', seriesName, pointIndex });
  }
  switch (data.cgElement) {
    case 'chartArea':
    case 'plotArea':
    case 'title':
    case 'legend':
      return Object.freeze({ kind: data.cgElement });
    case 'legendEntry':
      return seriesName ? Object.freeze({ kind: 'legendEntry', seriesName, ...(pointIndex === undefined ? {} : { pointIndex }) }) : null;
    case 'series':
      return seriesName ? Object.freeze({ kind: 'series', seriesName }) : null;
    case 'pointLabels':
      return seriesName ? Object.freeze({ kind: 'pointLabels', seriesName, ...(pointIndex === undefined ? {} : { pointIndex }) }) : null;
    case 'axis':
    case 'axisTitle':
    case 'majorGridLines':
    case 'minorGridLines':
      return axis ? Object.freeze({ kind: data.cgElement, ...axis }) : null;
    default:
      return null;
  }
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
    <path d="M2 7H26" fill="none" stroke={series.color} strokeWidth="2" strokeDasharray={dashArray(series.dashStyle, 2, false)} />
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
    dataTableMode: dataTableModeProp,
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
    appearance,
    interactive = true,
    onElementPointerDown,
    highlightedElement,
    className,
    style,
    dir: rootDirection,
    ...rootAttributes
  } = props;

  validateChartConfiguration(props);
  const documentMode = appearance !== undefined;
  const dataTableMode = dataTableModeProp ?? (documentMode ? 'visuallyHidden' : 'collapsed');
  const documentStyle = useMemo(() => appearance ? resolveDocumentStyle(appearance) : undefined, [appearance]);
  const [measureText] = useState(() => createTextMeasurer());
  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<ChartBrowserController | null>(null);
  const activeRef = useRef<CgChartPointRef | null>(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(1);
  const activationGenerationRef = useRef(1);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [dimensions, setDimensions] = useState(() => Object.freeze({
    width: documentMode && typeof width === 'number' ? width : fallbackWidth,
    height: documentMode && typeof height === 'number' ? height : fallbackHeight,
  }));
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
    ...(documentStyle ? {
      document: documentStyle,
      measure: measureText,
      ...(title ? { title } : {}),
      ...(legend ? { legend } : {}),
    } : {}),
  }), [
    annotations, argumentAxis, constantLines, dimensions.height, dimensions.width, documentStyle, formatter, legend,
    measureText, orientation, pointLabels, rtl, title, valueAxes, visibleModel,
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
      tooltip: interactive && tooltip?.enabled !== false,
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
  }, [activatePoint, enableKeyboardNavigation, interactive, onActivePoint, rtl, tooltip?.enabled]);

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
    // Dashboard charts lay out in 16px buckets so small resizes reuse the layout; document charts
    // are drawn at the exact pixel size.
    const bucket = documentMode ? 1 : 16;
    const measure = () => {
      frame = 0;
      if (!mountedRef.current || generation !== generationRef.current || !surface.isConnected) return;
      const nextWidth = Math.floor(surface.clientWidth / bucket) * bucket;
      const nextHeight = Math.floor(surface.clientHeight / bucket) * bucket;
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
  }, [documentMode]);

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
  const legendBefore = legendPosition === 'top' || legendPosition === 'start' || legendPosition === 'topEnd';

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onElementPointerDown) return;
    const surface = surfaceRef.current;
    const bounds = surface?.getBoundingClientRect();
    const x = bounds ? event.clientX - bounds.left : 0;
    const y = bounds ? event.clientY - bounds.top : 0;
    let element = readElement(event.target);
    if (!element) {
      if (!surface?.contains(event.target as Node)) return;
      const plot = layout.plot;
      element = x >= plot.x && x <= plot.x + plot.width && y >= plot.y && y <= plot.y + plot.height
        ? Object.freeze({ kind: 'plotArea' }) : Object.freeze({ kind: 'chartArea' });
    }
    onElementPointerDown(Object.freeze({
      element, x, y,
      button: event.button,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      originalEvent: event.nativeEvent,
    }));
  };

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
      ? <span key={seriesModel.name} className={styles.legendItem} data-cg-element="legendEntry" data-cg-series-name={seriesModel.name}>{content}</span>
      : <button key={seriesModel.name} type="button" className={styles.legendButton} aria-pressed={visible} onClick={activate} data-cg-element="legendEntry" data-cg-series-name={seriesModel.name}>{content}</button>;
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
    return <button key={`${pieSeries.name}-${point.pointIndex}`} type="button" className={styles.legendButton} aria-pressed="true" onClick={activate} data-cg-element="legendEntry" data-cg-series-name={pieSeries.name} data-cg-point-index={point.pointIndex}>
      {legend?.renderItem?.(context) ?? defaultContent}
    </button>;
  });

  const legendNode = !documentMode && legendPosition !== 'none' && sourceModel.series.some((candidate) => candidate.descriptor.showInLegend !== false)
    ? <div
        className={cx(styles.legend, styles[`legend${legendPosition[0]!.toUpperCase()}${legendPosition.slice(1)}`])}
        aria-label={resolvedStrings.legendAriaLabel}
        data-cg-element="legend"
        data-orientation={legend?.orientation ?? 'auto'}
      >{sourceModel.kind === 'pie'
        ? renderPieLegend()
        : sourceModel.series.filter((candidate) => candidate.descriptor.showInLegend !== false).map(renderLegendItem)}</div>
    : null;

  const canvas = <svg
    className={cx(styles.canvas, animation === 'onLoad' && styles.animate, !interactive && styles.static)}
    style={documentStyle?.fontFamily ? { fontFamily: documentStyle.fontFamily } : undefined}
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
    {layout.document && documentStyle ? <g aria-hidden="true" className={styles.documentLayer}>
      {renderDocumentBackground(layout, documentStyle)}
      {layout.document.grids.map(renderGrid)}
    </g> : <g className={styles.grid} aria-hidden="true">
      {layout.valueAxes.flatMap((axis) => {
        if (!axis.showGridLines) return [];
        const lineStyle = gridLineStyle(valueAxes?.find((candidate) => (candidate.name ?? 'primary') === axis.name)?.majorGridLineStyle);
        return axis.ticks.map((tick, index) => orientation === 'vertical'
          ? <line key={`${axis.name}-grid-${index}`} x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={tick.position} y2={tick.position} data-visible="true" style={lineStyle} />
          : <line key={`${axis.name}-grid-${index}`} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} x1={tick.position} x2={tick.position} data-visible="true" style={lineStyle} />);
      })}
      {sourceModel.kind === 'cartesian' && argumentAxis?.visible !== false && argumentAxis?.showGridLines ? layout.argumentTicks.map((tick, index) => orientation === 'vertical'
        ? <line key={`arg-grid-${index}`} x1={tick.position} x2={tick.position} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} data-visible="true" style={gridLineStyle(argumentAxis.majorGridLineStyle)} />
        : <line key={`arg-grid-${index}`} x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={tick.position} y2={tick.position} data-visible="true" style={gridLineStyle(argumentAxis.majorGridLineStyle)} />) : null}
    </g>}
    <g className={styles.zeroLines} aria-hidden="true">
      {layout.valueAxes.map((axis) => axis.showZeroLine && axis.zeroPosition !== null
        ? orientation === 'vertical'
          ? <line key={axis.name} x1={layout.plot.x} x2={layout.plot.x + layout.plot.width} y1={axis.zeroPosition} y2={axis.zeroPosition} />
          : <line key={axis.name} y1={layout.plot.y} y2={layout.plot.y + layout.plot.height} x1={axis.zeroPosition} x2={axis.zeroPosition} />
        : null)}
    </g>
    {layout.document ? <g aria-hidden="true" className={styles.documentLayer}>
      {layout.document.axes.map((axis, index) => renderDocumentAxis(axis, index, rtl))}
    </g> : <g className={styles.axes} aria-hidden="true">
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
    </g>}
    <g className={styles.seriesLayer}>
      {visibleModel.visibleSeries.map((seriesModel) => <g
        key={seriesModel.name}
        className={styles.series}
        data-cg-chart-series={seriesModel.name}
        data-cg-element="series"
        data-cg-series-name={seriesModel.name}
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
        <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={line.color} strokeWidth={line.width} strokeDasharray={dashArray(line.dashStyle, line.width, false)} />
        {line.label ? <text x={line.labelX} y={line.labelY} textAnchor={line.labelAnchor}>{line.label}</text> : null}
      </g>)}
    </g>
    <g className={styles.labels} aria-hidden="true">
      {layout.labels.map((label, index) => <g
        key={index}
        data-cg-element={label.seriesName === undefined ? undefined : 'pointLabels'}
        data-cg-series-name={label.seriesName}
        data-cg-point-index={label.pointIndex}
      >
        {label.connector ? <line {...label.connector} style={label.style ? { stroke: label.style.color } : undefined} /> : null}
        {label.style
          ? renderText({ x: label.x, y: label.y, text: label.text, anchor: label.anchor, style: label.style }, 'text', rtl)
          : <text x={label.x} y={label.y} textAnchor={label.anchor}>{label.text}</text>}
      </g>)}
    </g>
    <g className={styles.annotations} aria-hidden="true">
      {layout.annotations.map((annotation, index) => <text key={index} x={annotation.x} y={annotation.y} textAnchor="middle" className={annotation.className}>{annotation.text}</text>)}
    </g>
    {layout.document ? <g aria-hidden="true" className={styles.documentLayer}>
      {layout.document.title ? <g data-cg-element="title">
        <rect {...layout.document.title.box} className={styles.hitBox} />
        {layout.document.title.lines.map((line, index) => renderText(line, `title-${index}`, rtl))}
      </g> : null}
      {layout.document.legend ? <g data-cg-element="legend">
        <rect {...layout.document.legend.box} className={styles.hitBox} />
        {layout.document.legend.entries.map((entry, index) => renderLegendEntry(entry, index, rtl))}
      </g> : null}
    </g> : null}
    <g className={styles.hits} data-cg-interactive-only="">
      {layout.document ? layout.shapes.map((shape, index) => shape.kind === 'path' && !shape.fill
        ? <path key={`series-hit-${index}`} d={shape.path} fill="none" stroke="transparent" strokeWidth={Math.max(8, shape.lineWidth + 6)} className={styles.hitStroke} data-cg-element="series" data-cg-series-name={shape.seriesName} />
        : null) : null}
      {layout.hitTargets.map((target, index) => renderHitTarget(target, index, selectionKeys, activeKey, enableKeyboardNavigation, resolvedStrings.pointRoleDescription))}
    </g>
    {highlightedElement ? renderSelection(layout, highlightedElement, documentStyle?.selectionColor ?? 'var(--cg-chart-accent)') : null}
  </svg>;

  return <div
    {...rootAttributes}
    ref={rootRef}
    className={cx(styles.root, documentMode && styles.document, className)}
    style={rootStyle}
    onPointerDown={onElementPointerDown ? handlePointerDown : undefined}
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
    {title ? <p id={titleId} className={documentMode ? styles.visuallyHidden : styles.title} data-cg-element="title">{title}</p> : <span id={titleId} className={styles.visuallyHidden}>{ariaLabel ?? resolvedStrings.chartAriaLabel}</span>}
    {subtitle ? <p className={documentMode ? styles.visuallyHidden : styles.subtitle}>{subtitle}</p> : null}
    {description ? <p id={descriptionId} className={documentMode ? styles.visuallyHidden : styles.description}>{description}</p> : null}
    {legendBefore ? legendNode : null}
    <div
      ref={surfaceRef}
      className={cx(styles.surface, documentMode && styles.documentSurface)}
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
