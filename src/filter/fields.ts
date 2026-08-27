import { CG_FILTER_OPERATOR_REGISTRY, type CgFilterOperatorRegistry } from './operators';
import type { CgFilterFieldDescriptor, CgFilterOperator, CgFilterOperatorDescriptor } from './types';

function cleanId(value: string, label: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${label} must not be blank.`);
  if ([...result].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error(`${label} '${result}' contains control characters.`);
  return result;
}

export class CgFilterFieldRegistry<TItem = unknown> {
  readonly #fields: ReadonlyArray<CgFilterFieldDescriptor<TItem>>;
  readonly #byId: ReadonlyMap<string, CgFilterFieldDescriptor<TItem>>;
  readonly #aliases: ReadonlyMap<string, string>;

  constructor(fields: ReadonlyArray<CgFilterFieldDescriptor<TItem>>) {
    const byId = new Map<string, CgFilterFieldDescriptor<TItem>>();
    const aliases = new Map<string, string>();
    const normalized: CgFilterFieldDescriptor<TItem>[] = [];
    for (const source of fields) {
      const fieldId = cleanId(source.fieldId, 'Filter field ID');
      if (byId.has(fieldId) || aliases.has(fieldId)) throw new Error(`Filter field ID '${fieldId}' is duplicated or aliases another field.`);
      if (!source.label.trim()) throw new Error(`Filter field '${fieldId}' requires a label.`);
      const formerFieldIds = Object.freeze((source.formerFieldIds ?? []).map((alias) => cleanId(alias, 'Former filter field ID')));
      const field = Object.freeze({ ...source, fieldId, label: source.label.trim(), formerFieldIds }) as CgFilterFieldDescriptor<TItem>;
      byId.set(fieldId, field);
      normalized.push(field);
      for (const alias of formerFieldIds) {
        if (alias === fieldId || byId.has(alias) || aliases.has(alias)) throw new Error(`Former filter field ID '${alias}' is ambiguous.`);
        aliases.set(alias, fieldId);
      }
    }
    this.#fields = Object.freeze(normalized);
    this.#byId = byId;
    this.#aliases = aliases;
  }

  get all(): ReadonlyArray<CgFilterFieldDescriptor<TItem>> { return this.#fields; }
  contains(fieldId: string): boolean { return this.#byId.has(fieldId); }
  find(fieldId: string | undefined): CgFilterFieldDescriptor<TItem> | undefined {
    if (!fieldId) return undefined;
    return this.#byId.get(fieldId) ?? this.#byId.get(this.#aliases.get(fieldId) ?? '');
  }
  migrate(fieldId: string): string { return this.#aliases.get(fieldId) ?? fieldId; }
  byCategory(): ReadonlyMap<string, ReadonlyArray<CgFilterFieldDescriptor<TItem>>> {
    const result = new Map<string, CgFilterFieldDescriptor<TItem>[]>();
    for (const field of this.#fields) {
      const category = field.category ?? '';
      const group = result.get(category) ?? [];
      group.push(field);
      result.set(category, group);
    }
    return new Map([...result].map(([key, value]) => [key, Object.freeze(value)]));
  }
}

export function filterOperatorsForField(
  field: CgFilterFieldDescriptor,
  registry: CgFilterOperatorRegistry = CG_FILTER_OPERATOR_REGISTRY,
): ReadonlyArray<CgFilterOperatorDescriptor> {
  const available = registry.forField(field.kind, field.nullable !== false);
  if (!field.allowedOperators) return available;
  const allowed = new Set(field.allowedOperators);
  return available.filter((candidate) => allowed.has(candidate.operator));
}

export function defaultFilterOperator(
  field: CgFilterFieldDescriptor,
  registry: CgFilterOperatorRegistry = CG_FILTER_OPERATOR_REGISTRY,
): CgFilterOperator {
  const available = filterOperatorsForField(field, registry);
  if (field.defaultOperator && available.some((candidate) => candidate.operator === field.defaultOperator)) return field.defaultOperator;
  const first = available[0];
  if (!first) throw new Error(`Filter field '${field.fieldId}' has no available operators.`);
  return first.operator;
}

export function buildFilterSchemaSignature<TItem>(fields: ReadonlyArray<CgFilterFieldDescriptor<TItem>>): string {
  return [...fields]
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId))
    .map((field) => `${field.fieldId}:${field.kind}`)
    .join('|');
}
