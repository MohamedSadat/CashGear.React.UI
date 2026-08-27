import { CgFilterFieldRegistry } from './fields';
import { CG_FILTER_OPERATOR_REGISTRY, type CgFilterOperatorRegistry } from './operators';
import type { CgFilterFieldDescriptor, CgFilterNode, CgFilterPeriod, CgFilterValue } from './types';

const PERIOD_LABELS: Readonly<Record<CgFilterPeriod, string>> = Object.freeze({
  today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow', thisWeek: 'this week', lastWeek: 'last week',
  nextWeek: 'next week', thisMonth: 'this month', lastMonth: 'last month', nextMonth: 'next month',
  thisQuarter: 'this quarter', lastQuarter: 'last quarter', nextQuarter: 'next quarter', thisYear: 'this year',
  lastYear: 'last year', nextYear: 'next year', yearToDate: 'year to date', monthToDate: 'month to date',
  beforeThisYear: 'before this year', afterThisYear: 'after this year',
});

export interface FormatFilterOptions {
  readonly locale?: string;
  readonly conjunction?: string;
  readonly disjunction?: string;
  readonly unavailableField?: (fieldId: string) => string;
}

function formatValue(value: CgFilterValue, field: CgFilterFieldDescriptor, locale?: string): string {
  if (field.formatValue) return field.formatValue(value, locale);
  if (value.kind === 'relativePeriod') return PERIOD_LABELS[value.text as CgFilterPeriod] ?? value.text ?? '';
  if (value.kind === 'null') return field.nullText ?? 'blank';
  const option = field.options?.find((candidate) => candidate.value.kind === value.kind && candidate.value.text === value.text);
  if (option) return option.label;
  const text = value.text ?? '';
  if (value.kind === 'number') {
    const number = Number(text);
    if (Number.isFinite(number)) return new Intl.NumberFormat(locale).format(number);
  }
  if (value.kind === 'boolean') return /^true$/iu.test(text) ? 'Yes' : 'No';
  if (value.kind === 'date' || value.kind === 'dateTime') {
    const date = value.kind === 'date' ? new Date(`${text}T00:00:00Z`) : new Date(text);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(value.kind === 'dateTime' ? { timeStyle: 'short' as const } : {}), timeZone: value.kind === 'date' ? 'UTC' : undefined }).format(date);
  }
  return text;
}

export function formatFilter<TItem>(
  node: CgFilterNode | null,
  fields: CgFilterFieldRegistry<TItem>,
  options: FormatFilterOptions = {},
  operators: CgFilterOperatorRegistry = CG_FILTER_OPERATOR_REGISTRY,
): string {
  if (!node) return '';
  const render = (candidate: CgFilterNode, registry: CgFilterFieldRegistry<unknown>): string => {
    if (candidate.kind === 'group') {
      const separator = candidate.operator === 'and' ? options.conjunction ?? ' and ' : options.disjunction ?? ' or ';
      const content = candidate.children.map((child) => render(child, registry)).filter(Boolean).join(separator);
      return candidate.negated ? `not (${content})` : candidate.children.length > 1 ? `(${content})` : content;
    }
    if (candidate.kind === 'aggregate') {
      const collection = registry.find(candidate.collectionFieldId);
      const collectionLabel = collection?.label ?? options.unavailableField?.(candidate.collectionFieldId) ?? candidate.collectionFieldId;
      const nestedRegistry = collection?.collection ? new CgFilterFieldRegistry(collection.collection.elementFields) : new CgFilterFieldRegistry([]);
      const nested = candidate.nestedCriteria ? ` where ${render(candidate.nestedCriteria, nestedRegistry)}` : '';
      if (candidate.aggregate === 'exists') return `${collectionLabel} has an item${nested}`;
      const aggregateField = candidate.aggregateFieldId ? nestedRegistry.find(candidate.aggregateFieldId) : undefined;
      const result = candidate.resultOperator ? operators.find(candidate.resultOperator)?.key ?? candidate.resultOperator : '';
      const values = candidate.values.map((value) => formatValue(value, aggregateField ?? collection ?? { fieldId: '', label: '', kind: 'text' }, options.locale)).join(' and ');
      return `${candidate.aggregate} ${aggregateField?.label ?? collectionLabel}${nested} ${result} ${values}`.trim();
    }
    const field = registry.find(candidate.fieldId);
    const label = field?.label ?? options.unavailableField?.(candidate.fieldId) ?? candidate.fieldId;
    const operator = operators.find(candidate.operator)?.key ?? candidate.operator;
    const values = candidate.values.map((value) => formatValue(value, field ?? { fieldId: candidate.fieldId, label, kind: 'text' }, options.locale));
    if (!values.length) return `${label} ${operator}`;
    return `${label} ${operator} ${values.join(candidate.operator === 'isAnyOf' || candidate.operator === 'isNoneOf' ? ', ' : ' and ')}`;
  };
  return render(node, fields);
}
