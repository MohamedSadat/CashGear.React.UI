import type { CgChartPointRef } from './CgChart.types';

export interface ChartBrowserOptions {
  readonly tooltip: boolean;
  readonly keyboard: boolean;
  readonly rtl: boolean;
  readonly onActivePoint: (point: CgChartPointRef | null) => void;
  readonly onActivate: (point: CgChartPointRef, ctrlKey: boolean, shiftKey: boolean) => void;
}

export interface ChartBrowserController {
  readonly focus: (point?: CgChartPointRef | null) => boolean;
  readonly dispose: () => void;
}

function pointElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-cg-chart-point]') : null;
}

function pointRef(element: HTMLElement): CgChartPointRef | null {
  const seriesName = element.dataset.cgSeriesName;
  const pointIndex = Number(element.dataset.cgPointIndex);
  return seriesName && Number.isSafeInteger(pointIndex)
    ? Object.freeze({ seriesName, pointIndex })
    : null;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/gu, '\\$&');
}

function requestBrowserFrame(callback: FrameRequestCallback): number {
  return typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16);
}

function cancelBrowserFrame(frame: number): void {
  if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
  else window.clearTimeout(frame);
}

export function registerChartBrowser(
  root: HTMLElement,
  options: ChartBrowserOptions,
): ChartBrowserController {
  const tooltip = root.querySelector<HTMLElement>('[data-cg-chart-tooltip]');
  const surface = root.querySelector<HTMLElement>('[data-cg-chart-surface]');
  let hovered: HTMLElement | null = null;
  let frame = 0;
  let disposed = false;

  const hideTooltip = () => {
    hovered = null;
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.setAttribute('aria-hidden', 'true');
    }
    root.querySelectorAll<HTMLElement>('[data-cg-chart-series]').forEach((element) => delete element.dataset.cgHovered);
    root.querySelector<HTMLElement>('[data-cg-chart-canvas]')?.removeAttribute('data-cg-hovering');
  };

  const positionTooltip = () => {
    frame = 0;
    if (!tooltip || !surface || !hovered || disposed) return;
    const bounds = surface.getBoundingClientRect();
    const target = hovered.getBoundingClientRect();
    const size = tooltip.getBoundingClientRect();
    let left = target.left + target.width / 2 - bounds.left - size.width / 2;
    let top = target.top - bounds.top - size.height - 12;
    if (top < 0) top = target.bottom - bounds.top + 12;
    left = Math.max(0, Math.min(left, bounds.width - size.width));
    top = Math.max(0, Math.min(top, bounds.height - size.height));
    tooltip.style.insetInlineStart = `${left}px`;
    tooltip.style.insetBlockStart = `${top}px`;
  };

  const schedulePosition = () => {
    if (frame) return;
    frame = requestBrowserFrame(positionTooltip);
  };

  const showTooltip = (point: HTMLElement) => {
    if (!options.tooltip || !tooltip || point.dataset.cgTooltipEnabled === 'false') {
      hideTooltip();
      return;
    }
    hovered = point;
    const set = (selector: string, value: string | undefined) => {
      const target = tooltip.querySelector<HTMLElement>(selector);
      if (target) target.textContent = value ?? '';
    };
    set('[data-cg-tooltip-series]', point.dataset.cgSeriesName);
    set('[data-cg-tooltip-argument]', point.dataset.cgArgument);
    const percentage = point.dataset.cgPercentage;
    set('[data-cg-tooltip-value]', percentage ? `${point.dataset.cgValue} (${percentage})` : point.dataset.cgValue);
    const series = point.dataset.cgSeriesName;
    const canvas = root.querySelector<HTMLElement>('[data-cg-chart-canvas]');
    if (canvas) canvas.dataset.cgHovering = 'true';
    root.querySelectorAll<HTMLElement>('[data-cg-chart-series]').forEach((element) => {
      if (element.dataset.cgChartSeries === series) element.dataset.cgHovered = 'true';
      else delete element.dataset.cgHovered;
    });
    tooltip.hidden = false;
    tooltip.setAttribute('aria-hidden', 'false');
    schedulePosition();
  };

  const focusElement = (element: HTMLElement): boolean => {
    root.querySelectorAll<HTMLElement>('[data-cg-chart-point]').forEach((point) => { point.tabIndex = -1; });
    element.tabIndex = 0;
    element.focus({ preventScroll: true });
    options.onActivePoint(pointRef(element));
    return true;
  };

  const resolveNext = (current: HTMLElement, key: string): HTMLElement | null => {
    const seriesName = current.dataset.cgSeriesName ?? '';
    const pointIndex = Number(current.dataset.cgPointIndex);
    const inSeries = [...root.querySelectorAll<HTMLElement>(`[data-cg-chart-point][data-cg-series-name="${cssEscape(seriesName)}"]`)];
    const position = inSeries.indexOf(current);
    const forward = options.rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = options.rtl ? 'ArrowRight' : 'ArrowLeft';
    if (key === forward) return inSeries[Math.min(inSeries.length - 1, position + 1)] ?? current;
    if (key === backward) return inSeries[Math.max(0, position - 1)] ?? current;
    if (key === 'Home') return inSeries[0] ?? current;
    if (key === 'End') return inSeries.at(-1) ?? current;
    const names = [...new Set([...root.querySelectorAll<HTMLElement>('[data-cg-chart-point]')].map((element) => element.dataset.cgSeriesName ?? ''))];
    const seriesIndex = names.indexOf(seriesName);
    const nextName = key === 'ArrowDown' ? names[Math.min(names.length - 1, seriesIndex + 1)] : names[Math.max(0, seriesIndex - 1)];
    if (!nextName || nextName === seriesName) return current;
    const candidates = [...root.querySelectorAll<HTMLElement>(`[data-cg-chart-point][data-cg-series-name="${cssEscape(nextName)}"]`)];
    return candidates.reduce<HTMLElement | null>((nearest, candidate) => {
      if (!nearest) return candidate;
      return Math.abs(Number(candidate.dataset.cgPointIndex) - pointIndex)
        < Math.abs(Number(nearest.dataset.cgPointIndex) - pointIndex) ? candidate : nearest;
    }, null);
  };

  const onPointerOver = (event: PointerEvent) => {
    const point = pointElement(event.target);
    if (!point) { hideTooltip(); return; }
    if (point !== hovered) showTooltip(point);
  };
  const onPointerMove = (event: PointerEvent) => {
    const point = pointElement(event.target);
    if (!point) { hideTooltip(); return; }
    if (point !== hovered) showTooltip(point);
    else schedulePosition();
  };
  const onFocusIn = (event: FocusEvent) => {
    const point = pointElement(event.target);
    if (!point) return;
    showTooltip(point);
    options.onActivePoint(pointRef(point));
  };
  const onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    hideTooltip();
  };
  const activate = (point: HTMLElement, ctrlKey: boolean, shiftKey: boolean) => {
    const reference = pointRef(point);
    if (reference) options.onActivate(reference, ctrlKey, shiftKey);
  };
  const onClick = (event: MouseEvent) => {
    const point = pointElement(event.target);
    if (point) activate(point, event.ctrlKey || event.metaKey, event.shiftKey);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const point = pointElement(event.target);
    if (!point) return;
    if (event.key === 'Escape') {
      if (hovered) hideTooltip(); else root.focus();
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      activate(point, event.ctrlKey || event.metaKey, event.shiftKey);
      event.preventDefault();
      return;
    }
    if (!options.keyboard || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const next = resolveNext(point, event.key);
    if (next) { event.preventDefault(); focusElement(next); }
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerleave', hideTooltip);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);

  return Object.freeze({
    focus(reference?: CgChartPointRef | null) {
      const selector = reference
        ? `[data-cg-chart-point][data-cg-series-name="${cssEscape(reference.seriesName)}"][data-cg-point-index="${reference.pointIndex}"]`
        : '[data-cg-chart-point]';
      const target = root.querySelector<HTMLElement>(selector) ?? root.querySelector<HTMLElement>('[data-cg-chart-point]');
      return target ? focusElement(target) : false;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelBrowserFrame(frame);
      hideTooltip();
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', hideTooltip);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
    },
  });
}

const INLINE_PROPERTIES = [
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor',
] as const;

export function serializeChartSvg(root: HTMLElement): string | null {
  const source = root.querySelector<SVGSVGElement>('[data-cg-chart-canvas]');
  if (!source || typeof XMLSerializer === 'undefined') return null;
  const clone = source.cloneNode(true) as SVGSVGElement;
  const sources = [source, ...source.querySelectorAll<SVGElement>('*')];
  const clones = [clone, ...clone.querySelectorAll<SVGElement>('*')];
  sources.forEach((element, index) => {
    const target = clones[index];
    if (!target) return;
    if (target.tagName.toLowerCase() === 'title' || target.tagName.toLowerCase() === 'desc') {
      target.getAttributeNames().forEach((name) => target.removeAttribute(name));
      return;
    }
    const computed = getComputedStyle(element);
    INLINE_PROPERTIES.forEach((property) => {
      if (property === 'opacity' && element.hasAttribute('data-cg-chart-series')) {
        target.setAttribute('opacity', '1');
        return;
      }
      const value = computed.getPropertyValue(property);
      if ((value && value !== 'none') || property === 'fill') target.setAttribute(property, value);
    });
    target.removeAttribute('style');
    target.removeAttribute('class');
    target.getAttributeNames().forEach((name) => {
      if (name === 'data-cg-interactive-only') return;
      if (name === 'tabindex' || name === 'focusable' || name === 'role' || name.startsWith('aria-') || name.startsWith('data-cg-')) {
        target.removeAttribute(name);
      }
    });
  });
  clone.querySelectorAll('[data-cg-interactive-only]').forEach((element) => element.remove());
  return new XMLSerializer().serializeToString(clone);
}

export function sanitizeChartSvgFileName(fileName?: string): string {
  const withoutControls = [...(fileName ?? 'chart.svg')]
    .map((character) => character.charCodeAt(0) <= 31 ? '-' : character)
    .join('');
  const cleaned = withoutControls
    .replace(/[<>:"/\\|?*]/gu, '-')
    .replace(/[. ]+$/gu, '')
    .trim()
    .slice(0, 180) || 'chart';
  const baseName = cleaned.replace(/(?:\.svg)+$/giu, '') || 'chart';
  return `${baseName}.svg`;
}

export function downloadChartSvg(root: HTMLElement, fileName?: string): boolean {
  const markup = serializeChartSvg(root);
  if (!markup || typeof Blob === 'undefined' || typeof URL === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeChartSvgFileName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.queueMicrotask(() => URL.revokeObjectURL(url));
  return true;
}
