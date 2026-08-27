import {
  CG_FILTER_OPERATOR_REGISTRY, decodeFilterNode, defaultFilterOperator,
  normalizeFilterNode, validateFilter,
} from '../../filter';
import type {
  CgFilterAggregate, CgFilterEvaluationContext, CgFilterFieldRegistry, CgFilterLogicalOperator, CgFilterNode,
  CgFilterOperator, CgFilterProblem, CgFilterValue,
} from '../../filter';
import type { CgFilterBuilderFieldDescriptor, CgFilterBuilderValidationDetails } from './CgFilterBuilder.types';

export interface EditableGroup {
  readonly id: string;
  readonly kind: 'group';
  readonly operator: CgFilterLogicalOperator;
  readonly negated: boolean;
  readonly collapsed: boolean;
  readonly children: ReadonlyArray<EditableNode>;
}

export interface EditableCondition {
  readonly id: string;
  readonly kind: 'condition';
  readonly fieldId: string;
  readonly operator?: CgFilterOperator;
  readonly values: ReadonlyArray<CgFilterValue>;
}

export interface EditableAggregate {
  readonly id: string;
  readonly kind: 'aggregate';
  readonly collectionFieldId: string;
  readonly aggregate: CgFilterAggregate;
  readonly aggregateFieldId?: string;
  readonly resultOperator?: CgFilterOperator;
  readonly values: ReadonlyArray<CgFilterValue>;
  readonly nestedCriteria?: EditableGroup;
}

export type EditableNode = EditableGroup | EditableCondition | EditableAggregate;

export type FilterBuilderIdFactory = () => string;

export function emptyCondition(nextId: FilterBuilderIdFactory): EditableCondition {
  return { id: nextId(), kind: 'condition', fieldId: '', values: [] };
}

export function emptyAggregate(nextId: FilterBuilderIdFactory): EditableAggregate {
  return { id: nextId(), kind: 'aggregate', collectionFieldId: '', aggregate: 'exists', values: [] };
}

export function createEditableRoot(criteria: CgFilterNode | null | undefined, nextId: FilterBuilderIdFactory): EditableGroup {
  const visit = (node: CgFilterNode): EditableNode => {
    if (node.kind === 'condition') return { id: nextId(), kind: 'condition', fieldId: node.fieldId, operator: node.operator, values: [...node.values] };
    if (node.kind === 'aggregate') return {
      id: nextId(), kind: 'aggregate', collectionFieldId: node.collectionFieldId, aggregate: node.aggregate,
      aggregateFieldId: node.aggregateFieldId, resultOperator: node.resultOperator, values: [...node.values],
      nestedCriteria: node.nestedCriteria ? asGroup(visit(node.nestedCriteria), nextId) : undefined,
    };
    return { id: nextId(), kind: 'group', operator: node.operator, negated: Boolean(node.negated), collapsed: false, children: node.children.map(visit) };
  };
  const asGroup = (node: EditableNode, id: FilterBuilderIdFactory): EditableGroup => node.kind === 'group'
    ? node
    : { id: id(), kind: 'group', operator: 'and', negated: false, collapsed: false, children: [node] };
  const decoded = criteria ? decodeFilterNode(criteria) : null;
  return decoded ? asGroup(visit(decoded), nextId) : { id: nextId(), kind: 'group', operator: 'and', negated: false, collapsed: false, children: [emptyCondition(nextId)] };
}

function adaptValues(operator: CgFilterOperator | undefined, values: ReadonlyArray<CgFilterValue>): ReadonlyArray<CgFilterValue> {
  const arity = operator ? CG_FILTER_OPERATOR_REGISTRY.find(operator)?.arity : undefined;
  if (!arity || arity === 'none') return [];
  if (arity === 'one') return values.slice(0, 1);
  if (arity === 'two') return values.slice(0, 2);
  return values;
}

export function updateEditable(root: EditableGroup, nodeId: string, update: (node: EditableNode) => EditableNode): EditableGroup {
  const visit = (node: EditableNode): EditableNode => {
    if (node.id === nodeId) return update(node);
    if (node.kind !== 'group') {
      if (node.kind === 'aggregate' && node.nestedCriteria) return { ...node, nestedCriteria: visit(node.nestedCriteria) as EditableGroup };
      return node;
    }
    return { ...node, children: node.children.map(visit) };
  };
  return visit(root) as EditableGroup;
}

export function setEditableField<TItem>(root: EditableGroup, nodeId: string, field: CgFilterBuilderFieldDescriptor<TItem>): EditableGroup {
  return updateEditable(root, nodeId, (node) => {
    if (node.kind === 'condition') return { ...node, fieldId: field.fieldId, operator: defaultFilterOperator(field), values: [] };
    if (node.kind === 'aggregate') return { ...node, collectionFieldId: field.fieldId, aggregate: 'exists', aggregateFieldId: undefined, resultOperator: undefined, values: [], nestedCriteria: undefined };
    return node;
  });
}

export function setEditableOperator(root: EditableGroup, nodeId: string, operator: CgFilterOperator): EditableGroup {
  return updateEditable(root, nodeId, (node) => node.kind === 'condition'
    ? { ...node, operator, values: adaptValues(operator, node.values) }
    : node.kind === 'aggregate' ? { ...node, resultOperator: operator, values: adaptValues(operator, node.values) } : node);
}

export function cloneEditable(node: EditableNode, nextId: FilterBuilderIdFactory): EditableNode {
  if (node.kind === 'condition') return { ...node, id: nextId(), values: [...node.values] };
  if (node.kind === 'aggregate') return { ...node, id: nextId(), values: [...node.values], nestedCriteria: node.nestedCriteria ? cloneEditable(node.nestedCriteria, nextId) as EditableGroup : undefined };
  return { ...node, id: nextId(), children: node.children.map((child) => cloneEditable(child, nextId)) };
}

export function editChildren(root: EditableGroup, groupId: string, edit: (children: ReadonlyArray<EditableNode>) => ReadonlyArray<EditableNode>): EditableGroup {
  return updateEditable(root, groupId, (node) => node.kind === 'group' ? { ...node, children: edit(node.children) } : node);
}

export function removeEditable(root: EditableGroup, nodeId: string): EditableGroup {
  if (root.id === nodeId) return root;
  const visit = (group: EditableGroup): EditableGroup => ({ ...group, children: group.children.filter((child) => child.id !== nodeId).map((child) => child.kind === 'group' ? visit(child) : child.kind === 'aggregate' && child.nestedCriteria ? { ...child, nestedCriteria: visit(child.nestedCriteria) } : child) });
  return visit(root);
}

export function duplicateEditable(root: EditableGroup, nodeId: string, nextId: FilterBuilderIdFactory): EditableGroup {
  const visit = (group: EditableGroup): EditableGroup => {
    const children: EditableNode[] = [];
    for (const child of group.children) {
      const nested = child.kind === 'group' ? visit(child) : child.kind === 'aggregate' && child.nestedCriteria ? { ...child, nestedCriteria: visit(child.nestedCriteria) } : child;
      children.push(nested);
      if (child.id === nodeId) children.push(cloneEditable(child, nextId));
    }
    return { ...group, children };
  };
  return visit(root);
}

export function moveEditable(root: EditableGroup, nodeId: string, offset: -1 | 1): EditableGroup {
  const visit = (group: EditableGroup): EditableGroup => {
    const index = group.children.findIndex((child) => child.id === nodeId);
    if (index >= 0) {
      const target = index + offset;
      if (target < 0 || target >= group.children.length) return group;
      const children = [...group.children];
      const [moved] = children.splice(index, 1);
      children.splice(target, 0, moved!);
      return { ...group, children };
    }
    return { ...group, children: group.children.map((child) => child.kind === 'group' ? visit(child) : child.kind === 'aggregate' && child.nestedCriteria ? { ...child, nestedCriteria: visit(child.nestedCriteria) } : child) };
  };
  return visit(root);
}

export interface ProjectEditableResult extends CgFilterBuilderValidationDetails { readonly criteria: CgFilterNode | null; }

export function projectEditable<TItem>(root: EditableGroup, fields: CgFilterFieldRegistry<TItem>, evaluationContext?: CgFilterEvaluationContext): ProjectEditableResult {
  const incomplete: string[] = [];
  const visit = (node: EditableNode): CgFilterNode | null => {
    if (node.kind === 'condition') {
      if (!node.fieldId || !node.operator) { incomplete.push(node.id); return null; }
      return { kind: 'condition', fieldId: node.fieldId, operator: node.operator, values: [...node.values], source: 'builder' };
    }
    if (node.kind === 'aggregate') {
      if (!node.collectionFieldId || (node.aggregate !== 'exists' && !node.resultOperator)) { incomplete.push(node.id); return null; }
      return { kind: 'aggregate', collectionFieldId: node.collectionFieldId, aggregate: node.aggregate, aggregateFieldId: node.aggregateFieldId, resultOperator: node.resultOperator, values: [...node.values], source: 'builder', nestedCriteria: node.nestedCriteria ? visit(node.nestedCriteria) : undefined };
    }
    const children = node.children.map(visit).filter((child): child is CgFilterNode => child !== null);
    if (!children.length) return null;
    return { kind: 'group', operator: node.operator, negated: node.negated || undefined, children };
  };
  const criteria = normalizeFilterNode(visit(root));
  const validation = validateFilter(criteria, fields, { evaluationContext });
  const problems: CgFilterProblem[] = [...validation.problems];
  for (const id of incomplete) problems.push({ kind: 'missingValue', message: 'Complete this filter row before applying.', path: id, blocksApply: true });
  return { criteria, valid: validation.valid && incomplete.length === 0, problems, incompleteNodeIds: incomplete };
}
