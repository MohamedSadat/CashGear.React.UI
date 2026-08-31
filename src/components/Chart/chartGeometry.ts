import type { CgChartMarkerSymbol } from './CgChart.types';
import { svgNumber } from './chartPaths';

export interface ChartRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function markerPath(symbol: CgChartMarkerSymbol, x: number, y: number, size: number): string {
  const half = size / 2;
  switch (symbol) {
    case 'square':
      return `M${svgNumber(x - half)} ${svgNumber(y - half)}H${svgNumber(x + half)}V${svgNumber(y + half)}H${svgNumber(x - half)}Z`;
    case 'diamond':
      return `M${svgNumber(x)} ${svgNumber(y - half)}L${svgNumber(x + half)} ${svgNumber(y)}L${svgNumber(x)} ${svgNumber(y + half)}L${svgNumber(x - half)} ${svgNumber(y)}Z`;
    case 'triangle':
      return `M${svgNumber(x)} ${svgNumber(y - half)}L${svgNumber(x + half)} ${svgNumber(y + half)}L${svgNumber(x - half)} ${svgNumber(y + half)}Z`;
    case 'triangleDown':
      return `M${svgNumber(x - half)} ${svgNumber(y - half)}L${svgNumber(x + half)} ${svgNumber(y - half)}L${svgNumber(x)} ${svgNumber(y + half)}Z`;
    case 'cross':
      return `M${svgNumber(x - half)} ${svgNumber(y)}H${svgNumber(x + half)}M${svgNumber(x)} ${svgNumber(y - half)}V${svgNumber(y + half)}`;
    default:
      return '';
  }
}

export function rectanglesOverlap(left: ChartRectangle, right: ChartRectangle): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}
