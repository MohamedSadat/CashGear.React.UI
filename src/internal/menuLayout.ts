import type { MenuNode } from './menuTypes';

export interface MenuAdaptivePlan<TData> {
  visible: ReadonlyArray<MenuNode<TData>>;
  overflow: ReadonlyArray<MenuNode<TData>>;
  iconOnlyKeys: ReadonlySet<string>;
  stage: number;
  maxStage: number;
}

export function buildMenuAdaptivePlan<TData>(
  roots: ReadonlyArray<MenuNode<TData>>,
  stage: number,
  collapseCaptions: boolean,
  collapseToHamburger: boolean,
): MenuAdaptivePlan<TData> {
  const collapseOrder = collapseCaptions
    ? roots.filter((node) => node.icon).sort((left, right) => left.adaptivePriority - right.adaptivePriority || right.sourceIndex - left.sourceIndex)
    : [];
  const overflowOrder = collapseToHamburger
    ? [...roots].sort((left, right) => left.adaptivePriority - right.adaptivePriority || right.sourceIndex - left.sourceIndex)
    : [];
  const maxStage = collapseOrder.length + overflowOrder.length;
  const effective = Math.max(0, Math.min(stage, maxStage));
  const iconOnlyKeys = new Set(collapseOrder.slice(0, effective).map((node) => node.key));
  const overflowCount = Math.max(0, effective - collapseOrder.length);
  const overflowKeys = new Set(overflowOrder.slice(0, overflowCount).map((node) => node.key));
  return {
    visible: roots.filter((node) => !overflowKeys.has(node.key)),
    overflow: roots.filter((node) => overflowKeys.has(node.key)),
    iconOnlyKeys,
    stage: effective,
    maxStage,
  };
}

