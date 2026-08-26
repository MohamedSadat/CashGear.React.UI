export type ToolbarLayoutAlignment = 'start' | 'end';
export type ToolbarOverflowBehavior = 'auto' | 'never' | 'always';
export type ToolbarDisplayMode = 'full' | 'adaptive' | 'icon-only';

export interface ToolbarLayoutItem {
  name: string;
  visible: boolean;
  alignment: ToolbarLayoutAlignment;
  adaptivePriority: number;
  overflowBehavior: ToolbarOverflowBehavior;
  allowTextCollapse: boolean;
  hasIcon: boolean;
  hasAdaptiveText: boolean;
  custom: boolean;
  declarationIndex: number;
}

export interface ToolbarPlacement {
  name: string;
  displayMode: ToolbarDisplayMode;
}

export interface ToolbarLayoutPlan {
  start: ReadonlyArray<ToolbarPlacement>;
  end: ReadonlyArray<ToolbarPlacement>;
  overflow: ReadonlyArray<string>;
  stage: number;
  maxStage: number;
  removalOrder: ReadonlyArray<string>;
}

export const TOOLBAR_FULL_STAGE = 0;
export const TOOLBAR_ADAPTIVE_STAGE = 1;
export const TOOLBAR_ICON_STAGE = 2;
export const TOOLBAR_FIRST_OVERFLOW_STAGE = 3;

export function toolbarRemovalOrder(
  items: ReadonlyArray<ToolbarLayoutItem>,
  minimumVisibleItemCount: number,
): ReadonlyArray<string> {
  if (!Number.isInteger(minimumVisibleItemCount) || minimumVisibleItemCount < 0) {
    throw new RangeError('Toolbar minimumVisibleItemCount must be a nonnegative integer.');
  }
  const visible = items.filter((item) => item.visible);
  const railCount = visible.filter((item) => item.overflowBehavior !== 'always').length;
  const movable = Math.max(0, railCount - minimumVisibleItemCount);
  return visible
    .filter((item) => item.overflowBehavior === 'auto')
    .sort((left, right) => left.adaptivePriority - right.adaptivePriority || right.declarationIndex - left.declarationIndex)
    .slice(0, movable)
    .map((item) => item.name);
}

function displayMode(item: ToolbarLayoutItem, stage: number): ToolbarDisplayMode {
  if (!item.custom && stage >= TOOLBAR_ICON_STAGE && item.allowTextCollapse && item.hasIcon) return 'icon-only';
  if (!item.custom && stage >= TOOLBAR_ADAPTIVE_STAGE && item.hasAdaptiveText) return 'adaptive';
  return 'full';
}

/** Pure deterministic toolbar stage planner. */
export function planToolbarLayout(
  items: ReadonlyArray<ToolbarLayoutItem>,
  requestedStage: number,
  minimumVisibleItemCount = 0,
): ToolbarLayoutPlan {
  const visible = items.filter((item) => item.visible);
  const removalOrder = toolbarRemovalOrder(visible, minimumVisibleItemCount);
  const maxStage = TOOLBAR_ICON_STAGE + removalOrder.length;
  const stage = Math.min(Math.max(TOOLBAR_FULL_STAGE, Math.trunc(requestedStage)), Math.max(TOOLBAR_ICON_STAGE, maxStage));
  const movedCount = stage < TOOLBAR_FIRST_OVERFLOW_STAGE
    ? 0
    : Math.min(stage - TOOLBAR_FIRST_OVERFLOW_STAGE + 1, removalOrder.length);
  const moved = new Set(removalOrder.slice(0, movedCount));
  const start: ToolbarPlacement[] = [];
  const end: ToolbarPlacement[] = [];
  const overflow: string[] = [];
  for (const item of visible) {
    if (item.overflowBehavior === 'always' || moved.has(item.name)) {
      overflow.push(item.name);
      continue;
    }
    const placement = { name: item.name, displayMode: displayMode(item, stage) };
    (item.alignment === 'end' ? end : start).push(placement);
  }
  return Object.freeze({
    start: Object.freeze(start),
    end: Object.freeze(end),
    overflow: Object.freeze(overflow),
    stage,
    maxStage,
    removalOrder: Object.freeze([...removalOrder]),
  });
}
