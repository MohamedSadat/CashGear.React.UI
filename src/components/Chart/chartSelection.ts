import type { CgChartAxisRef, CgChartElementRef } from './CgChart.types';
import type { ChartRectangle } from './chartGeometry';
import type { ChartLayout } from './chartLayoutTypes';
import type { SvgPoint } from './chartPaths';

/** Outline rectangles and square handle centres that mark a selected element. */
export interface ChartSelectionGeometry {
  readonly rectangles: ReadonlyArray<ChartRectangle>;
  readonly handles: ReadonlyArray<SvgPoint>;
}

const MAX_RECTANGLES = 200;
const MAX_HANDLES = 2_000;

function sameAxis(left: CgChartAxisRef, right: CgChartAxisRef): boolean {
  return left.axis === right.axis && (left.axis === 'argument' || left.axisName === (right as { axisName?: string }).axisName);
}

function axisRef(element: CgChartAxisRef): CgChartAxisRef {
  return element.axis === 'argument' ? { axis: 'argument' } : { axis: 'value', axisName: element.axisName };
}

function corners(rectangles: ReadonlyArray<ChartRectangle>): SvgPoint[] {
  return rectangles.flatMap((rectangle) => [
    { x: rectangle.x, y: rectangle.y },
    { x: rectangle.x + rectangle.width, y: rectangle.y },
    { x: rectangle.x, y: rectangle.y + rectangle.height },
    { x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height },
  ]);
}

function boxed(rectangles: ReadonlyArray<ChartRectangle | null | undefined>): ChartSelectionGeometry {
  const present = rectangles.filter((rectangle): rectangle is ChartRectangle => Boolean(rectangle)).slice(0, MAX_RECTANGLES);
  return Object.freeze({ rectangles: Object.freeze(present), handles: Object.freeze(corners(present)) });
}

const EMPTY: ChartSelectionGeometry = Object.freeze({ rectangles: Object.freeze([]), handles: Object.freeze([]) });

/** Where to draw the selection outline for `element`, or nothing when the layout does not have it. */
export function selectionGeometry(layout: ChartLayout, element: CgChartElementRef | null | undefined): ChartSelectionGeometry {
  if (!element || layout.tooSmall || layout.isEmpty) return EMPTY;
  const document = layout.document;
  switch (element.kind) {
    case 'chartArea':
      return boxed([{ x: 0.5, y: 0.5, width: Math.max(0, layout.width - 1), height: Math.max(0, layout.height - 1) }]);
    case 'plotArea':
      return boxed([layout.plot]);
    case 'title':
      return boxed([document?.title?.box]);
    case 'legend':
      return boxed([document?.legend?.box]);
    case 'legendEntry':
      return boxed(document?.legend?.entries
        .filter((entry) => entry.seriesName === element.seriesName && (element.pointIndex === undefined || entry.pointIndex === element.pointIndex))
        .map((entry) => entry.box) ?? []);
    case 'axis':
      return boxed(document?.axes.filter((axis) => sameAxis(axis.ref, axisRef(element))).map((axis) => axis.box) ?? []);
    case 'axisTitle':
      return boxed(document?.axes.filter((axis) => sameAxis(axis.ref, axisRef(element))).map((axis) => axis.title?.box) ?? []);
    case 'majorGridLines':
    case 'minorGridLines': {
      const kind = element.kind === 'majorGridLines' ? 'major' : 'minor';
      const lines = document?.grids.filter((grid) => grid.kind === kind && sameAxis(grid.ref, axisRef(element))).flatMap((grid) => grid.lines) ?? [];
      return Object.freeze({
        rectangles: Object.freeze([]),
        handles: Object.freeze(lines.flatMap((line) => [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }]).slice(0, MAX_HANDLES)),
      });
    }
    case 'series': {
      const handles: SvgPoint[] = [];
      for (const shape of layout.shapes) {
        if (shape.seriesName !== element.seriesName) continue;
        if (shape.kind === 'bar') handles.push({ x: shape.bounds.x + shape.bounds.width / 2, y: shape.bounds.y + shape.bounds.height / 2 });
        else if (shape.kind === 'point') handles.push({ x: shape.x, y: shape.y });
        else if (shape.kind === 'arc') handles.push({ x: shape.midX, y: shape.midY });
      }
      if (!handles.length) {
        for (const target of layout.hitTargets) {
          if (target.point.seriesName === element.seriesName && target.x !== undefined && target.y !== undefined) handles.push({ x: target.x, y: target.y });
        }
      }
      return Object.freeze({ rectangles: Object.freeze([]), handles: Object.freeze(handles.slice(0, MAX_HANDLES)) });
    }
    case 'point': {
      const matches = layout.shapes.filter((shape) => shape.seriesName === element.seriesName && shape.kind !== 'path' && shape.point.pointIndex === element.pointIndex);
      const rectangles = matches.map((shape) => {
        if (shape.kind === 'bar') return shape.bounds;
        if (shape.kind === 'arc') return shape.bounds;
        if (shape.kind === 'point') {
          const half = shape.markerSize / 2 + 2;
          return { x: shape.x - half, y: shape.y - half, width: half * 2, height: half * 2 };
        }
        return null;
      });
      if (!rectangles.length) {
        const target = layout.hitTargets.find((candidate) => candidate.point.seriesName === element.seriesName && candidate.point.pointIndex === element.pointIndex);
        if (target?.x !== undefined && target.y !== undefined) rectangles.push({ x: target.x - 4, y: target.y - 4, width: 8, height: 8 });
      }
      return boxed(rectangles);
    }
    case 'pointLabels':
      return boxed(layout.labels
        .filter((label) => label.seriesName === element.seriesName && (element.pointIndex === undefined || label.pointIndex === element.pointIndex))
        .map((label) => label.box));
    default:
      return EMPTY;
  }
}
