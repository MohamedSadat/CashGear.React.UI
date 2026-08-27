import { CgFilterFieldRegistry, filterOperatorsForField } from './fields';
import { CG_FILTER_OPERATOR_REGISTRY, type CgFilterOperatorRegistry } from './operators';
import { CG_FILTER_PERIODS } from './periods';
import { enumerateFilterNodes, filterDepth } from './tree';
import { CG_FILTER_DEFAULT_LIMITS } from './types';
import type {
  CgFilterEvaluationContext, CgFilterFieldDescriptor, CgFilterLimits, CgFilterNode, CgFilterProblem,
  CgFilterProblemKind, CgFilterValidationResult, CgFilterValidationScope, CgFilterValue,
} from './types';
import { compareDecimalText, hasFilterValue, isValidFilterValue, parseFilterValue } from './values';

export interface ValidateFilterOptions<TItem> {
  readonly operators?: CgFilterOperatorRegistry;
  readonly limits?: CgFilterLimits;
  readonly scope?: CgFilterValidationScope;
  readonly isAuthorized?: (field: CgFilterFieldDescriptor<TItem>) => boolean;
  readonly evaluationContext?: CgFilterEvaluationContext;
}

function valueOrder(left: CgFilterValue, right: CgFilterValue, field: CgFilterFieldDescriptor): number | null {
  if (field.compareValues) return field.compareValues(field.parseValue?.(left) ?? parseFilterValue(left, field.kind), field.parseValue?.(right) ?? parseFilterValue(right, field.kind));
  if (field.kind === 'number') return compareDecimalText(left.text ?? '', right.text ?? '');
  const first = field.parseValue?.(left) ?? parseFilterValue(left, field.kind);
  const second = field.parseValue?.(right) ?? parseFilterValue(right, field.kind);
  if (first === null || second === null) return null;
  if (first instanceof Date && second instanceof Date) return first.getTime() - second.getTime();
  if (typeof first === 'boolean' && typeof second === 'boolean') return Number(first) - Number(second);
  const text = (value: unknown): string | null => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return value.toString();
    return null;
  };
  const firstText = text(first);
  const secondText = text(second);
  return firstText === null || secondText === null ? null : firstText.localeCompare(secondText, undefined, { sensitivity: 'base', numeric: true });
}

export function validateFilter<TItem>(
  node: CgFilterNode | null,
  fields: CgFilterFieldRegistry<TItem>,
  options: ValidateFilterOptions<TItem> = {},
): CgFilterValidationResult {
  const operators = options.operators ?? CG_FILTER_OPERATOR_REGISTRY;
  const limits = options.limits ?? CG_FILTER_DEFAULT_LIMITS;
  const scope = options.scope ?? 'apply';
  const problems: CgFilterProblem[] = [];
  const report = (kind: CgFilterProblemKind, message: string, path: string, fieldId?: string, blocksApply = true): void => {
    problems.push({ kind, message, path, ...(fieldId ? { fieldId } : {}), blocksApply });
  };
  if (!node) return { valid: true, problems };
  const nodes = enumerateFilterNodes(node);
  if (nodes.length > limits.maxNodes) report('tooManyNodes', `The filter has ${nodes.length} parts; at most ${limits.maxNodes} are allowed.`, '$');
  if (filterDepth(node) > limits.maxDepth) report('tooDeep', `Groups may be nested at most ${limits.maxDepth} levels.`, '$');

  const validateValues = (values: ReadonlyArray<CgFilterValue>, field: CgFilterFieldDescriptor, arity: 'none' | 'one' | 'two' | 'many', path: string): void => {
    const present = values.filter(hasFilterValue);
    if (arity === 'none' && present.length) report('tooManyValues', `${field.label} takes no value for this comparison.`, path, field.fieldId, false);
    if (arity === 'one' && !present.length) report('missingValue', `Enter a value for ${field.label}.`, path, field.fieldId);
    if (arity === 'two' && present.length < 2) report('missingValue', `Enter both ends of the range for ${field.label}.`, path, field.fieldId);
    if (arity === 'many' && !present.length) report('emptySet', `Choose at least one value for ${field.label}.`, path, field.fieldId);
    if (arity === 'many' && present.length > limits.maxValuesPerSet) report('tooManyValues', `A set may contain at most ${limits.maxValuesPerSet} values.`, path, field.fieldId);
    for (const value of present) {
      if (value.kind === 'relativePeriod') {
        if (!CG_FILTER_PERIODS.includes(value.text as never)) report('invalidValue', `'${value.text}' is not a known relative period.`, path, field.fieldId);
        else if (!options.evaluationContext && scope === 'apply') report('missingDateContext', 'Relative-period filters require an explicit clock and timezone context.', path, field.fieldId);
      } else {
        const parsed = field.parseValue?.(value);
        if (field.parseValue ? parsed === null || parsed === undefined : !isValidFilterValue(value, field.kind)) {
          report('invalidValue', `'${value.text ?? ''}' is not a valid ${field.label} value.`, path, field.fieldId);
        }
      }
    }
    if (arity === 'two' && present.length >= 2 && (valueOrder(present[0]!, present[1]!, field) ?? 0) > 0) report('reversedRange', `The range for ${field.label} starts after it ends.`, path, field.fieldId);
  };

  const walk = (current: CgFilterNode, path: string, registry: CgFilterFieldRegistry<unknown> = fields): void => {
    if (current.kind === 'group') {
      if (!current.children.length) report('emptyGroup', 'This group is empty and will be ignored.', path, undefined, false);
      if (current.children.length > limits.maxConditionsPerGroup) report('tooManyConditions', `A group may contain at most ${limits.maxConditionsPerGroup} parts.`, path);
      current.children.forEach((child, index) => walk(child, `${path}.children[${index}]`, registry));
      return;
    }
    if (current.kind === 'condition') {
      const field = registry.find(current.fieldId);
      if (!field) { report('unknownField', `Unknown filter field '${current.fieldId}'.`, path, current.fieldId); return; }
      if (registry === fields && options.isAuthorized && !options.isAuthorized(field)) { report('unauthorizedField', `The filter field '${field.label}' is not authorized.`, path, field.fieldId); return; }
      if (field.enabled === false) report('disabledField', `The filter field '${field.label}' cannot be edited.`, path, field.fieldId, false);
      const available = filterOperatorsForField(field, operators);
      const descriptor = operators.find(current.operator);
      if (!descriptor || !available.some((candidate) => candidate.operator === current.operator)) { report('unsupportedOperator', `'${current.operator}' cannot be used with ${field.label}.`, path, field.fieldId); return; }
      if (scope === 'server' && descriptor.serverTranslatable === false) report('notServerTranslatable', `'${current.operator}' cannot be sent to a server provider.`, path, field.fieldId);
      if (scope === 'persist' && descriptor.persistable === false) report('notPersistable', `'${current.operator}' cannot be persisted.`, path, field.fieldId);
      validateValues(current.values, field, descriptor.arity, path);
      return;
    }
    const collection = registry.find(current.collectionFieldId);
    if (!collection) { report('unknownField', `Unknown filter field '${current.collectionFieldId}'.`, path, current.collectionFieldId); return; }
    if (registry === fields && options.isAuthorized && !options.isAuthorized(collection)) { report('unauthorizedField', `The filter field '${collection.label}' is not authorized.`, path, collection.fieldId); return; }
    if (!collection.collection) { report('invalidAggregate', `${collection.label} is not a registered collection.`, path, collection.fieldId); return; }
    const allowed = collection.collection.aggregates ?? ['exists', 'count'];
    if (!allowed.includes(current.aggregate)) report('invalidAggregate', `'${current.aggregate}' is not available for ${collection.label}.`, path, collection.fieldId);
    const elementRegistry = new CgFilterFieldRegistry(collection.collection.elementFields);
    if (current.aggregate !== 'exists') {
      if (!current.resultOperator) report('invalidAggregate', `'${current.aggregate}' requires a result comparison.`, path, collection.fieldId);
      else {
        const descriptor = operators.find(current.resultOperator);
        if (!descriptor?.allowedForAggregateResult) report('unsupportedOperator', `'${current.resultOperator}' cannot compare an aggregate result.`, path, collection.fieldId);
        else {
          const aggregateField = current.aggregate === 'count'
            ? { fieldId: collection.fieldId, label: collection.label, kind: 'number' as const }
            : elementRegistry.find(current.aggregateFieldId);
          const resultField = current.aggregate === 'sum' || current.aggregate === 'average'
            ? { fieldId: collection.fieldId, label: collection.label, kind: 'number' as const }
            : aggregateField;
          if (resultField) validateValues(current.values, resultField, descriptor.arity, path);
        }
      }
      if (current.aggregate !== 'count' && (!current.aggregateFieldId || !elementRegistry.find(current.aggregateFieldId))) report('unknownField', `'${current.aggregateFieldId ?? ''}' is not an aggregate field of ${collection.label}.`, path, current.aggregateFieldId);
    }
    if (current.nestedCriteria) walk(current.nestedCriteria, `${path}.nestedCriteria`, elementRegistry);
  };
  walk(node, '$');
  return { valid: problems.every((problem) => !problem.blocksApply), problems: Object.freeze(problems) };
}
