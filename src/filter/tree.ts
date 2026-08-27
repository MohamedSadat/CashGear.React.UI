import { decodeFilterNode } from './codec';
import { CG_FILTER_OPERATOR_REGISTRY, type CgFilterOperatorRegistry } from './operators';
import type { CgFilterNode, CgFilterSource, CgFilterValue } from './types';
import { hasFilterValue } from './values';

export function enumerateFilterNodes(node: CgFilterNode | null): ReadonlyArray<CgFilterNode> {
  const result: CgFilterNode[] = [];
  const visit = (candidate: CgFilterNode): void => {
    result.push(candidate);
    if (candidate.kind === 'group') candidate.children.forEach(visit);
    else if (candidate.kind === 'aggregate' && candidate.nestedCriteria) visit(candidate.nestedCriteria);
  };
  if (node) visit(node);
  return result;
}

export function filterDepth(node: CgFilterNode | null): number {
  if (!node) return 0;
  if (node.kind === 'group') return 1 + Math.max(0, ...node.children.map(filterDepth));
  if (node.kind === 'aggregate' && node.nestedCriteria) return 1 + filterDepth(node.nestedCriteria);
  return 1;
}

export function filterNodeCount(node: CgFilterNode | null): number { return enumerateFilterNodes(node).length; }

function valuesEqual(left: ReadonlyArray<CgFilterValue>, right: ReadonlyArray<CgFilterValue>): boolean {
  return left.length === right.length && left.every((value, index) => value.kind === right[index]?.kind && value.text === right[index]?.text);
}

export function areFiltersEquivalent(left: CgFilterNode | null, right: CgFilterNode | null): boolean {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.kind === 'condition' && right.kind === 'condition') return left.fieldId === right.fieldId && left.operator === right.operator && (left.source ?? 'caller') === (right.source ?? 'caller') && valuesEqual(left.values, right.values);
  if (left.kind === 'group' && right.kind === 'group') return left.operator === right.operator && Boolean(left.negated) === Boolean(right.negated) && left.children.length === right.children.length && left.children.every((child, index) => areFiltersEquivalent(child, right.children[index] ?? null));
  if (left.kind === 'aggregate' && right.kind === 'aggregate') return left.collectionFieldId === right.collectionFieldId && left.aggregate === right.aggregate && left.aggregateFieldId === right.aggregateFieldId && left.resultOperator === right.resultOperator && (left.source ?? 'caller') === (right.source ?? 'caller') && valuesEqual(left.values, right.values) && areFiltersEquivalent(left.nestedCriteria ?? null, right.nestedCriteria ?? null);
  return false;
}

function normalizeValues(values: ReadonlyArray<CgFilterValue>, arity: 'none' | 'one' | 'two' | 'many'): ReadonlyArray<CgFilterValue> {
  const present = values.filter(hasFilterValue).map((value) => Object.freeze({ ...value }));
  if (arity === 'none') return [];
  if (arity === 'one') return present.slice(0, 1);
  if (arity === 'two') return present.slice(0, 2);
  const seen = new Set<string>();
  return present.filter((value) => { const key = `${value.kind}\u0000${value.text ?? ''}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export function normalizeFilterNode(input: unknown, operators: CgFilterOperatorRegistry = CG_FILTER_OPERATOR_REGISTRY): CgFilterNode | null {
  const decoded = decodeFilterNode(input);
  const visit = (node: CgFilterNode): CgFilterNode | null => {
    if (node.kind === 'condition') {
      const descriptor = operators.find(node.operator);
      const values = normalizeValues(node.values, descriptor?.arity ?? 'one');
      return Object.freeze({ ...node, source: node.source ?? 'caller', values: Object.freeze(values) });
    }
    if (node.kind === 'aggregate') {
      const descriptor = node.resultOperator ? operators.find(node.resultOperator) : undefined;
      const values = normalizeValues(node.values, descriptor?.arity ?? (node.aggregate === 'exists' ? 'none' : 'one'));
      const nestedCriteria = node.nestedCriteria ? visit(node.nestedCriteria) : null;
      return Object.freeze({ ...node, source: node.source ?? 'caller', values: Object.freeze(values), ...(nestedCriteria ? { nestedCriteria } : { nestedCriteria: null }) });
    }
    const normalized = node.children.map(visit).filter((child): child is CgFilterNode => child !== null);
    const children: CgFilterNode[] = [];
    for (const child of normalized) {
      if (!node.negated && child.kind === 'group' && !child.negated && child.operator === node.operator) children.push(...child.children);
      else children.push(child);
    }
    if (!children.length) return null;
    if (children.length === 1 && !node.negated) return children[0]!;
    return Object.freeze({ kind: 'group', operator: node.operator, children: Object.freeze(children), ...(node.negated ? { negated: true } : {}) });
  };
  return decoded ? visit(decoded) : null;
}

function rebuildGroup(group: Extract<CgFilterNode, { kind: 'group' }>, children: ReadonlyArray<CgFilterNode>): CgFilterNode | null {
  if (!children.length) return null;
  if (children.length === 1 && !group.negated) return children[0]!;
  return Object.freeze({ ...group, children: Object.freeze([...children]) });
}

export function removeFilterSource(node: CgFilterNode | null, source: CgFilterSource): CgFilterNode | null {
  if (!node) return null;
  if (node.kind === 'condition' || node.kind === 'aggregate') return (node.source ?? 'caller') === source ? null : node;
  return rebuildGroup(node, node.children.map((child) => removeFilterSource(child, source)).filter((child): child is CgFilterNode => child !== null));
}

export function combineFilters(preserved: CgFilterNode | null, additions: ReadonlyArray<CgFilterNode>): CgFilterNode | null {
  const copied = additions.map((node) => decodeFilterNode(node)!);
  if (!preserved) return copied.length === 0 ? null : copied.length === 1 ? copied[0]! : Object.freeze({ kind: 'group', operator: 'and', children: Object.freeze(copied) });
  if (!copied.length) return preserved;
  return Object.freeze({ kind: 'group', operator: 'and', children: Object.freeze([preserved, ...copied]) });
}

export function mapFilterFieldIds(node: CgFilterNode | null, map: (fieldId: string) => string): CgFilterNode | null {
  if (!node) return null;
  if (node.kind === 'condition') return Object.freeze({ ...node, fieldId: map(node.fieldId), values: Object.freeze([...node.values]) });
  if (node.kind === 'aggregate') return Object.freeze({ ...node, collectionFieldId: map(node.collectionFieldId), aggregateFieldId: node.aggregateFieldId ? map(node.aggregateFieldId) : undefined, nestedCriteria: mapFilterFieldIds(node.nestedCriteria ?? null, map), values: Object.freeze([...node.values]) });
  return Object.freeze({ ...node, children: Object.freeze(node.children.map((child) => mapFilterFieldIds(child, map)!)) });
}

export function pruneFilterFields(node: CgFilterNode | null, isKnown: (fieldId: string) => boolean): CgFilterNode | null {
  if (!node) return null;
  if (node.kind === 'condition') return isKnown(node.fieldId) ? node : null;
  if (node.kind === 'aggregate') return isKnown(node.collectionFieldId) ? Object.freeze({ ...node, nestedCriteria: pruneFilterFields(node.nestedCriteria ?? null, isKnown) }) : null;
  return rebuildGroup(node, node.children.map((child) => pruneFilterFields(child, isKnown)).filter((child): child is CgFilterNode => child !== null));
}

export function removeFilterField(node: CgFilterNode | null, fieldId: string): CgFilterNode | null {
  return pruneFilterFields(node, (candidate) => candidate !== fieldId);
}
