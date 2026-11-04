/** How far a group has shrunk: `full` as declared, `compact` with large items made small, `icons` without text, `collapsed` into one button. */
export type RibbonGroupMode = 'full' | 'compact' | 'icons' | 'collapsed';

export interface RibbonLayoutGroup {
  readonly key: string;
  readonly priority: number;
  readonly hasLargeItems: boolean;
  readonly hasHideableText: boolean;
}

export interface RibbonLayoutStep {
  readonly key: string;
  readonly mode: RibbonGroupMode;
}

/**
 * The order groups shrink in, one step per stage. Every group gives up large buttons,
 * then text, before any group collapses, so commands stay visible for as long as possible.
 * Within a round, lower priorities go first, and among equals the later group does.
 */
export function ribbonLayoutSteps(groups: ReadonlyArray<RibbonLayoutGroup>): ReadonlyArray<RibbonLayoutStep> {
  const order = groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => left.group.priority - right.group.priority || right.index - left.index)
    .map(({ group }) => group);
  return [
    ...order.filter((group) => group.hasLargeItems).map((group): RibbonLayoutStep => ({ key: group.key, mode: 'compact' })),
    ...order.filter((group) => group.hasHideableText).map((group): RibbonLayoutStep => ({ key: group.key, mode: 'icons' })),
    ...order.map((group): RibbonLayoutStep => ({ key: group.key, mode: 'collapsed' })),
  ];
}

export function planRibbonLayout(groups: ReadonlyArray<RibbonLayoutGroup>, stage: number): ReadonlyMap<string, RibbonGroupMode> {
  const modes = new Map<string, RibbonGroupMode>(groups.map((group) => [group.key, 'full']));
  for (const step of ribbonLayoutSteps(groups).slice(0, Math.max(0, stage))) modes.set(step.key, step.mode);
  return modes;
}
