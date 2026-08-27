import { CgFilterFieldRegistry } from './fields';
import { CG_FILTER_OPERATOR_REGISTRY, type CgFilterOperatorRegistry } from './operators';
import { resolveFilterPeriod, valueCivilDate } from './periods';
import type { CgFilterCondition, CgFilterEvaluationContext, CgFilterFieldDescriptor, CgFilterNode, CgFilterOperator, CgFilterValue } from './types';
import { compareDecimalText, hasFilterValue, parseFilterValue } from './values';

export class CgFilterEvaluationError extends Error { constructor(message: string) { super(message); this.name = 'CgFilterEvaluationError'; } }

function blank(value: unknown): boolean { return value === null || value === undefined || typeof value === 'string' && !value.trim(); }
function scalarText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return value.toString();
  return null;
}
function display<TItem>(value: unknown, field: CgFilterFieldDescriptor<TItem>, locale?: string): string {
  if (value === null || value === undefined) return field.nullText ?? '';
  if (value instanceof Date) return new Intl.DateTimeFormat(locale, { dateStyle: 'short', ...(field.kind === 'dateTime' ? { timeStyle: 'short' as const } : {}) }).format(value);
  if (typeof value === 'number') return new Intl.NumberFormat(locale).format(value);
  return scalarText(value) ?? '';
}
function compare<TItem>(left: unknown, rightValue: CgFilterValue, field: CgFilterFieldDescriptor<TItem>, context?: CgFilterEvaluationContext): number | null {
  const right = field.parseValue?.(rightValue) ?? parseFilterValue(rightValue, field.kind);
  if (left === null || left === undefined || right === null || right === undefined) return null;
  if (field.compareValues) return field.compareValues(left, right);
  if (field.kind === 'number') {
    const leftText = scalarText(left);
    const rightText = scalarText(right);
    return leftText === null || rightText === null ? null : compareDecimalText(leftText, rightText);
  }
  if (field.kind === 'date') {
    const leftText = valueCivilDate(left, context?.timeZone) ?? scalarText(left);
    const rightText = scalarText(right);
    return leftText === null || rightText === null ? null : leftText.localeCompare(rightText);
  }
  if (field.kind === 'dateTime') {
    if (rightValue.kind === 'date') {
      const rightText = scalarText(right);
      return rightText === null ? null : (valueCivilDate(left, context?.timeZone) ?? '').localeCompare(rightText);
    }
    const leftText = scalarText(left);
    const rightText = scalarText(right);
    const leftTime = left instanceof Date ? left.getTime() : leftText === null ? Number.NaN : Date.parse(leftText);
    const rightTime = right instanceof Date ? right.getTime() : rightText === null ? Number.NaN : Date.parse(rightText);
    return Number.isNaN(leftTime) || Number.isNaN(rightTime) ? null : leftTime - rightTime;
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  const leftText = scalarText(left);
  const rightText = scalarText(right);
  return leftText === null || rightText === null ? null : leftText.localeCompare(rightText, undefined, { sensitivity: 'base', numeric: true });
}
function wildcard(actual: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '.*').replace(/\?/gu, '.');
  return new RegExp(`^${escaped}$`, 'iu').test(actual);
}
function relational(result: number | null, operator: CgFilterOperator): boolean {
  if (result === null) return false;
  if (operator === 'equals') return result === 0;
  if (operator === 'notEquals') return result !== 0;
  if (operator === 'greaterThan') return result > 0;
  if (operator === 'greaterThanOrEqual') return result >= 0;
  if (operator === 'lessThan') return result < 0;
  if (operator === 'lessThanOrEqual') return result <= 0;
  return false;
}
function conditionMatches<TItem>(condition: CgFilterCondition, raw: unknown, field: CgFilterFieldDescriptor<TItem>, context?: CgFilterEvaluationContext): boolean {
  const operator = condition.operator;
  if (operator === 'isNull') return raw === null || raw === undefined;
  if (operator === 'isNotNull') return raw !== null && raw !== undefined;
  if (operator === 'isBlank') return blank(raw);
  if (operator === 'isNotBlank') return !blank(raw);
  if (raw === null || raw === undefined) return false;
  const values = condition.values.filter(hasFilterValue);
  if (!values.length) return true;
  if (operator === 'inPeriod' || operator === 'notInPeriod') {
    if (!context) throw new CgFilterEvaluationError('Relative-period filters require an explicit evaluation context.');
    const period = values[0]?.text;
    const range = resolveFilterPeriod(period as never, context);
    const day = valueCivilDate(raw, context.timeZone);
    if (!day) return false;
    const inside = (!range.start || day >= range.start) && (!range.endExclusive || day < range.endExclusive);
    return operator === 'inPeriod' ? inside : !inside;
  }
  const text = display(raw, field, context?.locale);
  const needle = values[0]?.text ?? '';
  if (operator === 'contains') return text.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
  if (operator === 'notContains') return !text.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
  if (operator === 'startsWith') return text.toLocaleLowerCase().startsWith(needle.toLocaleLowerCase());
  if (operator === 'endsWith') return text.toLocaleLowerCase().endsWith(needle.toLocaleLowerCase());
  if (operator === 'isLike' || operator === 'isNotLike') { const match = wildcard(text, needle); return operator === 'isLike' ? match : !match; }
  if (operator === 'isAnyOf' || operator === 'isNoneOf') {
    const match = values.some((value) => compare(raw, value, field, context) === 0);
    return operator === 'isAnyOf' ? match : !match;
  }
  if (operator === 'between' || operator === 'notBetween') {
    const low = compare(raw, values[0]!, field, context);
    const high = values[1] ? compare(raw, values[1], field, context) : null;
    const match = low !== null && low >= 0 && (high === null || high <= 0);
    return operator === 'between' ? match : !match;
  }
  return relational(compare(raw, values[0]!, field, context), operator);
}

export function evaluateFilter<TItem>(node: CgFilterNode | null, item: TItem, fields: CgFilterFieldRegistry<TItem>, context?: CgFilterEvaluationContext, operators: CgFilterOperatorRegistry = CG_FILTER_OPERATOR_REGISTRY): boolean {
  if (!node) return true;
  if (node.kind === 'group') {
    const value = node.operator === 'and' ? node.children.every((child) => evaluateFilter(child, item, fields, context, operators)) : node.children.some((child) => evaluateFilter(child, item, fields, context, operators));
    return node.negated ? !value : value;
  }
  if (node.kind === 'condition') {
    const field = fields.find(node.fieldId);
    if (!field?.accessor) throw new CgFilterEvaluationError(`Filter field '${node.fieldId}' has no registered accessor.`);
    if (!operators.find(node.operator)) throw new CgFilterEvaluationError(`Filter operator '${node.operator}' is not registered.`);
    return conditionMatches(node, field.accessor(item), field, context);
  }
  const collectionField = fields.find(node.collectionFieldId);
  if (!collectionField?.accessor || !collectionField.collection) throw new CgFilterEvaluationError(`Filter collection '${node.collectionFieldId}' is not registered.`);
  const value = collectionField.accessor(item);
  if (!Array.isArray(value)) return false;
  const elementFields = new CgFilterFieldRegistry(collectionField.collection.elementFields);
  const matched = node.nestedCriteria ? value.filter((element) => evaluateFilter(node.nestedCriteria ?? null, element, elementFields, context, operators)) : value;
  if (node.aggregate === 'exists') return matched.length > 0;
  let aggregate: unknown = matched.length;
  if (node.aggregate !== 'count') {
    const aggregateField = elementFields.find(node.aggregateFieldId ?? '');
    if (!aggregateField?.accessor) throw new CgFilterEvaluationError(`Aggregate field '${node.aggregateFieldId ?? ''}' is not registered.`);
    const values = matched.map((element) => aggregateField.accessor!(element)).filter((candidate) => candidate !== null && candidate !== undefined);
    if (!values.length) return false;
    if (node.aggregate === 'sum' || node.aggregate === 'average') {
      const numbers = values.map(Number).filter(Number.isFinite);
      if (!numbers.length) return false;
      const sum = numbers.reduce((total, candidate) => total + candidate, 0);
      aggregate = node.aggregate === 'sum' ? sum : sum / numbers.length;
    } else aggregate = values.reduce((best, candidate) => {
      const comparison = (scalarText(candidate) ?? '').localeCompare(scalarText(best) ?? '', undefined, { numeric: true });
      return comparison * (node.aggregate === 'minimum' ? 1 : -1) < 0 ? candidate : best;
    });
  }
  if (!node.resultOperator) return false;
  const synthetic: CgFilterCondition = { kind: 'condition', fieldId: collectionField.fieldId, operator: node.resultOperator, values: node.values, source: node.source };
  return conditionMatches(synthetic, aggregate, { ...collectionField, kind: typeof aggregate === 'number' ? 'number' : 'text' }, context);
}

export function compileFilterPredicate<TItem>(node: CgFilterNode | null, fields: CgFilterFieldRegistry<TItem>, context?: CgFilterEvaluationContext): (item: TItem) => boolean {
  // Resolve every accessor before returning a reusable predicate so failures never occur midway through a data scan.
  const verify = (candidate: CgFilterNode, registry: CgFilterFieldRegistry<unknown>): void => {
    if (candidate.kind === 'group') { candidate.children.forEach((child) => verify(child, registry)); return; }
    const fieldId = candidate.kind === 'condition' ? candidate.fieldId : candidate.collectionFieldId;
    const field = registry.find(fieldId);
    if (!field?.accessor) throw new CgFilterEvaluationError(`Filter field '${fieldId}' has no registered accessor.`);
    if (candidate.kind === 'aggregate') {
      if (!field.collection) throw new CgFilterEvaluationError(`Filter collection '${fieldId}' is not registered.`);
      const nested = new CgFilterFieldRegistry(field.collection.elementFields);
      if (candidate.aggregateFieldId && !nested.find(candidate.aggregateFieldId)?.accessor) throw new CgFilterEvaluationError(`Aggregate field '${candidate.aggregateFieldId}' has no registered accessor.`);
      if (candidate.nestedCriteria) verify(candidate.nestedCriteria, nested);
    }
  };
  if (node) verify(node, fields);
  return (item) => evaluateFilter(node, item, fields, context);
}
