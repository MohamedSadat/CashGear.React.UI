export type CgFilterLogicalOperator = 'and' | 'or';

export type CgFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isNull'
  | 'isNotNull'
  | 'isBlank'
  | 'isNotBlank'
  | 'between'
  | 'isAnyOf'
  | 'isNoneOf'
  | 'notBetween'
  | 'isLike'
  | 'isNotLike'
  | 'inPeriod'
  | 'notInPeriod';

export type CgFilterSource = 'caller' | 'filterRow' | 'builder';
export type CgFilterAggregate = 'exists' | 'count' | 'sum' | 'average' | 'minimum' | 'maximum';
export type CgFilterValueKind = 'null' | 'text' | 'number' | 'boolean' | 'date' | 'dateTime' | 'time' | 'guid' | 'relativePeriod';
export type CgFilterPeriod =
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'thisWeek'
  | 'lastWeek'
  | 'nextWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'nextMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'nextQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'nextYear'
  | 'yearToDate'
  | 'monthToDate'
  | 'beforeThisYear'
  | 'afterThisYear';

export interface CgFilterValue {
  readonly kind: CgFilterValueKind;
  readonly text?: string;
}

export interface CgFilterGroup {
  readonly kind: 'group';
  readonly operator: CgFilterLogicalOperator;
  readonly children: ReadonlyArray<CgFilterNode>;
  readonly negated?: boolean;
}

export interface CgFilterCondition {
  readonly kind: 'condition';
  readonly fieldId: string;
  readonly operator: CgFilterOperator;
  readonly values: ReadonlyArray<CgFilterValue>;
  readonly source?: CgFilterSource;
}

export interface CgFilterAggregateCondition {
  readonly kind: 'aggregate';
  readonly collectionFieldId: string;
  readonly aggregate: CgFilterAggregate;
  readonly nestedCriteria?: CgFilterNode | null;
  readonly aggregateFieldId?: string;
  readonly resultOperator?: CgFilterOperator;
  readonly values: ReadonlyArray<CgFilterValue>;
  readonly source?: CgFilterSource;
}

export type CgFilterNode = CgFilterGroup | CgFilterCondition | CgFilterAggregateCondition;

/** Accepted only at compatibility boundaries. Canonical output always uses `values`. */
export interface CgLegacyFilterCondition {
  readonly kind: 'condition';
  readonly fieldId: string;
  readonly operator: CgFilterOperator;
  readonly value?: unknown;
  readonly secondValue?: unknown;
  readonly source?: CgFilterSource;
}

export interface CgLegacyFilterGroup {
  readonly kind: 'group';
  readonly operator: CgFilterLogicalOperator;
  readonly children: ReadonlyArray<CgFilterNodeInput>;
  readonly negated?: boolean;
}

export type CgFilterNodeInput = CgFilterNode | CgLegacyFilterCondition | CgLegacyFilterGroup;

export type CgFilterFieldKind = 'text' | 'number' | 'boolean' | 'date' | 'dateTime' | 'time' | 'enumeration' | 'guid' | 'collection';
export type CgFilterArity = 'none' | 'one' | 'two' | 'many';
export type CgFilterEditorKind = 'automatic' | 'none' | 'text' | 'number' | 'boolean' | 'date' | 'dateRange' | 'comboBox' | 'tagBox' | 'lookupGrid' | 'period';

export interface CgFilterOperatorDescriptor {
  readonly operator: CgFilterOperator;
  readonly key: string;
  readonly arity: CgFilterArity;
  readonly fieldKinds: ReadonlyArray<CgFilterFieldKind>;
  readonly editor?: CgFilterEditorKind;
  readonly serverTranslatable?: boolean;
  readonly persistable?: boolean;
  readonly allowedForAggregateResult?: boolean;
  readonly requiresNullableField?: boolean;
}

export interface CgFilterFieldOption {
  readonly value: CgFilterValue;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface CgFilterCollectionMetadata<TElement = unknown> {
  readonly elementFields: ReadonlyArray<CgFilterFieldDescriptor<TElement>>;
  readonly aggregates?: ReadonlyArray<CgFilterAggregate>;
  readonly elementLabel?: string;
}

export type CgFilterAccessor<TItem> = { access(item: TItem): unknown }['access'];

export interface CgFilterFieldDescriptor<TItem = unknown> {
  readonly fieldId: string;
  readonly label: string;
  readonly kind: CgFilterFieldKind;
  readonly accessor?: CgFilterAccessor<TItem>;
  readonly description?: string;
  readonly category?: string;
  readonly serverFieldId?: string;
  readonly formerFieldIds?: ReadonlyArray<string>;
  readonly visible?: boolean;
  readonly enabled?: boolean;
  readonly nullable?: boolean;
  readonly allowedOperators?: ReadonlyArray<CgFilterOperator>;
  readonly defaultOperator?: CgFilterOperator;
  readonly editorKind?: CgFilterEditorKind;
  readonly format?: string;
  readonly nullText?: string;
  readonly options?: ReadonlyArray<CgFilterFieldOption>;
  readonly sensitive?: boolean;
  readonly permission?: string;
  readonly collection?: CgFilterCollectionMetadata;
  readonly parseValue?: (value: CgFilterValue) => unknown;
  readonly formatValue?: (value: CgFilterValue, locale?: string) => string;
  readonly compareValues?: (left: unknown, right: unknown) => number | null;
}

export interface CgFilterLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxConditionsPerGroup: number;
  readonly maxValuesPerSet: number;
}

export const CG_FILTER_DEFAULT_LIMITS: CgFilterLimits = Object.freeze({
  maxDepth: 8,
  maxNodes: 200,
  maxConditionsPerGroup: 50,
  maxValuesPerSet: 200,
});

export type CgFilterProblemKind =
  | 'unknownNode'
  | 'unknownField'
  | 'unauthorizedField'
  | 'disabledField'
  | 'unsupportedOperator'
  | 'missingValue'
  | 'tooManyValues'
  | 'invalidValue'
  | 'reversedRange'
  | 'emptySet'
  | 'emptyGroup'
  | 'tooDeep'
  | 'tooManyNodes'
  | 'tooManyConditions'
  | 'invalidAggregate'
  | 'notServerTranslatable'
  | 'notPersistable'
  | 'missingDateContext';

export interface CgFilterProblem {
  readonly kind: CgFilterProblemKind;
  readonly message: string;
  readonly path: string;
  readonly fieldId?: string;
  readonly blocksApply: boolean;
}

export interface CgFilterValidationResult {
  readonly valid: boolean;
  readonly problems: ReadonlyArray<CgFilterProblem>;
}

export type CgFilterValidationScope = 'apply' | 'server' | 'persist';

export interface CgFilterEvaluationContext {
  readonly now: () => Date;
  readonly timeZone: string;
  /** 0 is Sunday and 6 is Saturday. */
  readonly firstDayOfWeek: number;
  readonly locale?: string;
}

export interface CgFilterDateRange {
  readonly start: string | null;
  readonly endExclusive: string | null;
}

export interface CgFilterWireValue {
  readonly kind: number;
  readonly text?: string;
}

export type CgFilterWireNode =
  | { readonly $type: 'group'; readonly operator: number; readonly children: ReadonlyArray<CgFilterWireNode>; readonly negated?: true }
  | { readonly $type: 'condition'; readonly fieldId: string; readonly operator: number; readonly values: ReadonlyArray<CgFilterWireValue>; readonly source: number }
  | { readonly $type: 'aggregate'; readonly collectionFieldId: string; readonly aggregate: number; readonly aggregateFieldId?: string; readonly resultOperator?: number; readonly nested?: CgFilterWireNode; readonly values: ReadonlyArray<CgFilterWireValue>; readonly source: number };

export type CgFilterScope = 'personal' | 'role' | 'company';

export interface CgFilterSavedView {
  readonly version: 1;
  readonly filterKey: string;
  readonly name: string;
  readonly scope: CgFilterScope;
  readonly roleName?: string;
  readonly isDefault?: boolean;
  readonly schemaSignature: string;
  readonly criteria: CgFilterNode | null;
  readonly concurrencyToken?: string;
}

export interface CgFilterLoadResult {
  readonly criteria: CgFilterNode | null;
  readonly problems: ReadonlyArray<CgFilterProblem>;
  readonly succeeded: boolean;
  readonly schemaChanged: boolean;
}

export interface CgFilterStore {
  list(filterKey: string, signal: AbortSignal): PromiseLike<ReadonlyArray<CgFilterSavedView>>;
  load(filterKey: string, name: string, signal: AbortSignal): PromiseLike<CgFilterSavedView | null>;
  save(view: CgFilterSavedView, signal: AbortSignal): PromiseLike<void>;
  rename(filterKey: string, name: string, newName: string, signal: AbortSignal): PromiseLike<void>;
  delete(filterKey: string, name: string, signal: AbortSignal): PromiseLike<void>;
  setDefault(filterKey: string, name: string | undefined, signal: AbortSignal): PromiseLike<void>;
}
