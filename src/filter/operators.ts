import type { CgFilterFieldKind, CgFilterOperator, CgFilterOperatorDescriptor } from './types';

const EQUATABLE: ReadonlyArray<CgFilterFieldKind> = ['text', 'number', 'boolean', 'date', 'dateTime', 'time', 'enumeration', 'guid'];
const COMPARABLE: ReadonlyArray<CgFilterFieldKind> = ['text', 'number', 'date', 'dateTime', 'time', 'enumeration'];
const TEXT: ReadonlyArray<CgFilterFieldKind> = ['text'];
const TEMPORAL: ReadonlyArray<CgFilterFieldKind> = ['date', 'dateTime'];
const ALL: ReadonlyArray<CgFilterFieldKind> = [...EQUATABLE, 'collection'];

function descriptor(
  operator: CgFilterOperator,
  key: string,
  arity: CgFilterOperatorDescriptor['arity'],
  fieldKinds: ReadonlyArray<CgFilterFieldKind>,
  options: Partial<Omit<CgFilterOperatorDescriptor, 'operator' | 'key' | 'arity' | 'fieldKinds'>> = {},
): CgFilterOperatorDescriptor {
  return Object.freeze({ operator, key, arity, fieldKinds: Object.freeze([...fieldKinds]), serverTranslatable: true, persistable: true, ...options });
}

export const CG_FILTER_OPERATORS: ReadonlyArray<CgFilterOperatorDescriptor> = Object.freeze([
  descriptor('equals', 'equals', 'one', EQUATABLE, { allowedForAggregateResult: true }),
  descriptor('notEquals', 'not-equals', 'one', EQUATABLE, { allowedForAggregateResult: true }),
  descriptor('contains', 'contains', 'one', TEXT),
  descriptor('notContains', 'not-contains', 'one', TEXT),
  descriptor('startsWith', 'starts-with', 'one', TEXT),
  descriptor('endsWith', 'ends-with', 'one', TEXT),
  descriptor('isLike', 'is-like', 'one', TEXT),
  descriptor('isNotLike', 'is-not-like', 'one', TEXT),
  descriptor('greaterThan', 'greater-than', 'one', COMPARABLE, { allowedForAggregateResult: true }),
  descriptor('greaterThanOrEqual', 'greater-than-or-equal', 'one', COMPARABLE, { allowedForAggregateResult: true }),
  descriptor('lessThan', 'less-than', 'one', COMPARABLE, { allowedForAggregateResult: true }),
  descriptor('lessThanOrEqual', 'less-than-or-equal', 'one', COMPARABLE, { allowedForAggregateResult: true }),
  descriptor('between', 'between', 'two', COMPARABLE, { allowedForAggregateResult: true }),
  descriptor('notBetween', 'not-between', 'two', COMPARABLE, { allowedForAggregateResult: true }),
  descriptor('isAnyOf', 'is-any-of', 'many', EQUATABLE, { editor: 'tagBox' }),
  descriptor('isNoneOf', 'is-none-of', 'many', EQUATABLE, { editor: 'tagBox' }),
  descriptor('inPeriod', 'in-period', 'one', TEMPORAL, { editor: 'period' }),
  descriptor('notInPeriod', 'not-in-period', 'one', TEMPORAL, { editor: 'period' }),
  descriptor('isBlank', 'is-blank', 'none', TEXT, { editor: 'none' }),
  descriptor('isNotBlank', 'is-not-blank', 'none', TEXT, { editor: 'none' }),
  descriptor('isNull', 'is-null', 'none', ALL, { editor: 'none', requiresNullableField: true }),
  descriptor('isNotNull', 'is-not-null', 'none', ALL, { editor: 'none', requiresNullableField: true }),
]);

export class CgFilterOperatorRegistry {
  readonly #ordered: ReadonlyArray<CgFilterOperatorDescriptor>;
  readonly #byOperator: ReadonlyMap<CgFilterOperator, CgFilterOperatorDescriptor>;

  constructor(descriptors: ReadonlyArray<CgFilterOperatorDescriptor> = CG_FILTER_OPERATORS) {
    const byOperator = new Map<CgFilterOperator, CgFilterOperatorDescriptor>();
    const ordered: CgFilterOperatorDescriptor[] = [];
    for (const candidate of descriptors) {
      if (byOperator.has(candidate.operator)) throw new Error(`Filter operator '${candidate.operator}' is duplicated.`);
      const copy = descriptor(candidate.operator, candidate.key, candidate.arity, candidate.fieldKinds, candidate);
      byOperator.set(copy.operator, copy);
      ordered.push(copy);
    }
    this.#ordered = Object.freeze(ordered);
    this.#byOperator = byOperator;
  }

  get all(): ReadonlyArray<CgFilterOperatorDescriptor> { return this.#ordered; }
  find(operator: CgFilterOperator): CgFilterOperatorDescriptor | undefined { return this.#byOperator.get(operator); }
  get(operator: CgFilterOperator): CgFilterOperatorDescriptor {
    const result = this.find(operator);
    if (!result) throw new Error(`Filter operator '${operator}' is not registered.`);
    return result;
  }
  supports(operator: CgFilterOperator, kind: CgFilterFieldKind, nullable = true): boolean {
    const result = this.find(operator);
    return Boolean(result?.fieldKinds.includes(kind) && (nullable || !result.requiresNullableField));
  }
  forField(kind: CgFilterFieldKind, nullable = true): ReadonlyArray<CgFilterOperatorDescriptor> {
    return this.#ordered.filter((candidate) => candidate.fieldKinds.includes(kind) && (nullable || !candidate.requiresNullableField));
  }
  without(...operators: ReadonlyArray<CgFilterOperator>): CgFilterOperatorRegistry {
    const excluded = new Set(operators);
    return new CgFilterOperatorRegistry(this.#ordered.filter((candidate) => !excluded.has(candidate.operator)));
  }
  with(...descriptors: ReadonlyArray<CgFilterOperatorDescriptor>): CgFilterOperatorRegistry {
    const replacements = new Map(descriptors.map((candidate) => [candidate.operator, candidate]));
    const result = this.#ordered.map((candidate) => replacements.get(candidate.operator) ?? candidate);
    for (const candidate of descriptors) if (!this.#byOperator.has(candidate.operator)) result.push(candidate);
    return new CgFilterOperatorRegistry(result);
  }
  ordered(...operators: ReadonlyArray<CgFilterOperator>): CgFilterOperatorRegistry {
    const rank = new Map(operators.map((operator, index) => [operator, index]));
    return new CgFilterOperatorRegistry([...this.#ordered].sort((left, right) =>
      (rank.get(left.operator) ?? operators.length + this.#ordered.indexOf(left)) -
      (rank.get(right.operator) ?? operators.length + this.#ordered.indexOf(right))));
  }
}

export const CG_FILTER_OPERATOR_REGISTRY = new CgFilterOperatorRegistry();
