import type { TreeViewModel, TreeViewModelDescriptor, TreeViewModelNode } from './treeViewModel';

export type TreeViewCheckMode = 'disabled' | 'multiple' | 'recursive';
export type TreeViewCheckState = 'none' | 'unchecked' | 'checked' | 'mixed';

function canCheck<T extends TreeViewModelDescriptor>(node: TreeViewModelNode<T>): boolean {
  return node.modelVisible && node.descriptor.disabled !== true && node.descriptor.allowCheck !== false;
}

export function reconcileTreeViewCheckedKeys<T extends TreeViewModelDescriptor>(
  model: TreeViewModel<T>,
  keys: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set(model.checkableNodes.filter((node) => keys.has(node.key)).map((node) => node.key));
}

export function treeViewCheckState<T extends TreeViewModelDescriptor>(
  node: TreeViewModelNode<T>,
  checkedKeys: ReadonlySet<string>,
  mode: TreeViewCheckMode,
): TreeViewCheckState {
  if (mode === 'disabled' || !canCheck(node)) return 'none';
  if (mode === 'multiple' || node.checkableDescendantKeys.length === 0) {
    return checkedKeys.has(node.key) ? 'checked' : 'unchecked';
  }
  const checkedDescendants = node.checkableDescendantKeys.filter((key) => checkedKeys.has(key)).length;
  if (checkedDescendants === node.checkableDescendantKeys.length) return 'checked';
  return checkedDescendants === 0 && !checkedKeys.has(node.key) ? 'unchecked' : 'mixed';
}

export function proposeTreeViewCheckedKeys<T extends TreeViewModelDescriptor>(
  model: TreeViewModel<T>,
  current: ReadonlySet<string>,
  key: string,
  checked: boolean,
  mode: TreeViewCheckMode,
): ReadonlySet<string> {
  const node = model.byKey.get(key);
  if (!node || mode === 'disabled' || !canCheck(node)) return new Set(current);
  const next = new Set(current);
  const affected = mode === 'recursive' ? [node.key, ...node.checkableDescendantKeys] : [node.key];
  for (const affectedKey of affected) {
    if (checked) next.add(affectedKey); else next.delete(affectedKey);
  }
  if (mode === 'recursive') {
    let ancestor = node.parentKey ? model.byKey.get(node.parentKey) : undefined;
    while (ancestor) {
      if (canCheck(ancestor)) {
        const descendants = ancestor.checkableDescendantKeys;
        const allChecked = descendants.length > 0 && descendants.every((descendantKey) => next.has(descendantKey));
        if (allChecked) next.add(ancestor.key); else next.delete(ancestor.key);
      }
      ancestor = ancestor.parentKey ? model.byKey.get(ancestor.parentKey) : undefined;
    }
  }
  return next;
}

export function allTreeViewCheckedKeys<T extends TreeViewModelDescriptor>(model: TreeViewModel<T>): ReadonlySet<string> {
  return new Set(model.checkableNodes.map((node) => node.key));
}
