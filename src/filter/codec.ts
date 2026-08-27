import { CG_FILTER_DEFAULT_LIMITS } from './types';
import type {
  CgFilterAggregate, CgFilterLimits, CgFilterLogicalOperator, CgFilterNode, CgFilterOperator,
  CgFilterSource, CgFilterValue, CgFilterValueKind, CgFilterWireNode, CgFilterWireValue,
} from './types';
import { filterValueFromUnknown } from './values';

const OPERATORS: ReadonlyArray<CgFilterOperator> = [
  'equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'greaterThan',
  'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual', 'isNull', 'isNotNull', 'isBlank', 'isNotBlank',
  'between', 'isAnyOf', 'isNoneOf', 'notBetween', 'isLike', 'isNotLike', 'inPeriod', 'notInPeriod',
];
const SOURCES: ReadonlyArray<CgFilterSource> = ['caller', 'filterRow', 'builder'];
const LOGICAL: ReadonlyArray<CgFilterLogicalOperator> = ['and', 'or'];
const VALUE_KINDS: ReadonlyArray<CgFilterValueKind> = ['null', 'text', 'number', 'boolean', 'date', 'dateTime', 'time', 'guid', 'relativePeriod'];
const AGGREGATES: ReadonlyArray<CgFilterAggregate> = ['exists', 'count', 'sum', 'average', 'minimum', 'maximum'];

export class CgFilterCodecError extends Error {
  readonly path: string;
  constructor(message: string, path = '$') { super(`${message} at ${path}.`); this.name = 'CgFilterCodecError'; this.path = path; }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CgFilterCodecError('A filter node must be an object', path);
  return value as Record<string, unknown>;
}

function property(value: Record<string, unknown>, name: string): unknown {
  const key = Object.keys(value).find((candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase());
  return key === undefined ? undefined : value[key];
}

function hasProperty(value: Record<string, unknown>, name: string): boolean {
  return Object.keys(value).some((candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase());
}

function string(value: unknown, label: string, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CgFilterCodecError(`${label} must be a non-empty string`, path);
  return value;
}

function enumValue<T extends string>(value: unknown, values: ReadonlyArray<T>, label: string, path: string, fallbackOrdinal?: number): T {
  if (typeof value === 'string' && values.includes(value as T)) return value as T;
  if (typeof value === 'number' && Number.isInteger(value) && values[value]) return values[value];
  if (value === undefined && fallbackOrdinal !== undefined && values[fallbackOrdinal]) return values[fallbackOrdinal];
  throw new CgFilterCodecError(`Unknown ${label} '${String(value)}'`, path);
}

function readValue(input: unknown, path: string): CgFilterValue {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return filterValueFromUnknown(input);
  const value = input as Record<string, unknown>;
  const kind = enumValue(property(value, 'kind'), VALUE_KINDS, 'filter value kind', `${path}.kind`);
  if (kind === 'null') return Object.freeze({ kind: 'null' });
  const text = property(value, 'text');
  if (typeof text !== 'string') throw new CgFilterCodecError('A typed filter value requires text', `${path}.text`);
  return Object.freeze({ kind, text });
}

function legacyValues(value: Record<string, unknown>, path: string): ReadonlyArray<CgFilterValue> {
  const values = property(value, 'values');
  if (Array.isArray(values)) return Object.freeze(values.map((candidate, index) => readValue(candidate, `${path}.values[${index}]`)));
  const first = hasProperty(value, 'value') ? filterValueFromUnknown(property(value, 'value')) : undefined;
  const second = hasProperty(value, 'secondValue') ? filterValueFromUnknown(property(value, 'secondValue')) : undefined;
  const result = [first, second].filter((candidate): candidate is CgFilterValue => Boolean(candidate && candidate.kind !== 'null' && candidate.text?.trim()));
  return Object.freeze(result);
}

export function decodeFilterNode(input: unknown, limits: CgFilterLimits = CG_FILTER_DEFAULT_LIMITS): CgFilterNode | null {
  if (input === null || input === undefined) return null;
  let count = 0;
  const read = (candidate: unknown, path: string, depth: number): CgFilterNode => {
    if (++count > limits.maxNodes) throw new CgFilterCodecError(`A filter may contain at most ${limits.maxNodes} nodes`, path);
    if (depth > limits.maxDepth) throw new CgFilterCodecError(`A filter may be nested at most ${limits.maxDepth} levels`, path);
    const value = record(candidate, path);
    const discriminator = property(value, '$type') ?? property(value, 'kind');
    if (discriminator === 'group') {
      const childrenInput = property(value, 'children');
      if (!Array.isArray(childrenInput)) throw new CgFilterCodecError('A group requires a children array', `${path}.children`);
      if (childrenInput.length > limits.maxConditionsPerGroup) throw new CgFilterCodecError(`A group may contain at most ${limits.maxConditionsPerGroup} children`, `${path}.children`);
      const operator = enumValue(property(value, 'operator'), LOGICAL, 'logical operator', `${path}.operator`);
      const children = Object.freeze(childrenInput.map((child, index) => read(child, `${path}.children[${index}]`, depth + 1)));
      return Object.freeze({ kind: 'group', operator, children, ...(property(value, 'negated') === true ? { negated: true } : {}) });
    }
    if (discriminator === 'condition') {
      const fieldId = string(property(value, 'fieldId'), 'fieldId', `${path}.fieldId`);
      const operator = enumValue(property(value, 'operator'), OPERATORS, 'filter operator', `${path}.operator`);
      const source = enumValue(property(value, 'source'), SOURCES, 'filter source', `${path}.source`, 0);
      return Object.freeze({ kind: 'condition', fieldId, operator, values: legacyValues(value, path), source });
    }
    if (discriminator === 'aggregate') {
      const collectionFieldId = string(property(value, 'collectionFieldId'), 'collectionFieldId', `${path}.collectionFieldId`);
      const aggregate = enumValue(property(value, 'aggregate'), AGGREGATES, 'filter aggregate', `${path}.aggregate`);
      const source = enumValue(property(value, 'source'), SOURCES, 'filter source', `${path}.source`, 0);
      const nestedInput = property(value, 'nested') ?? property(value, 'nestedCriteria');
      const nestedCriteria = nestedInput === undefined || nestedInput === null ? undefined : read(nestedInput, `${path}.nested`, depth + 1);
      const aggregateFieldInput = property(value, 'aggregateFieldId');
      const resultOperatorInput = property(value, 'resultOperator');
      const aggregateFieldId = aggregateFieldInput === undefined ? undefined : string(aggregateFieldInput, 'aggregateFieldId', `${path}.aggregateFieldId`);
      const resultOperator = resultOperatorInput === undefined ? undefined : enumValue(resultOperatorInput, OPERATORS, 'result operator', `${path}.resultOperator`);
      return Object.freeze({ kind: 'aggregate', collectionFieldId, aggregate, values: legacyValues(value, path), source, ...(nestedCriteria ? { nestedCriteria } : {}), ...(aggregateFieldId ? { aggregateFieldId } : {}), ...(resultOperator ? { resultOperator } : {}) });
    }
    throw new CgFilterCodecError(`Unknown filter node type '${String(discriminator)}'`, path);
  };
  return read(input, '$', 1);
}

function ordinal<T extends string>(value: T, values: ReadonlyArray<T>, label: string): number {
  const result = values.indexOf(value);
  if (result < 0) throw new CgFilterCodecError(`Unknown ${label} '${value}'`);
  return result;
}

function encodeValue(value: CgFilterValue): CgFilterWireValue {
  const kind = ordinal(value.kind, VALUE_KINDS, 'filter value kind');
  return value.text === undefined ? { kind } : { kind, text: value.text };
}

export function encodeFilterNode(node: CgFilterNode | null): CgFilterWireNode | null {
  if (!node) return null;
  if (node.kind === 'group') return {
    $type: 'group', operator: ordinal(node.operator, LOGICAL, 'logical operator'),
    ...(node.negated ? { negated: true as const } : {}), children: node.children.map((child) => encodeFilterNode(child)!),
  };
  if (node.kind === 'condition') return {
    $type: 'condition', fieldId: node.fieldId, operator: ordinal(node.operator, OPERATORS, 'filter operator'),
    values: node.values.map(encodeValue), source: ordinal(node.source ?? 'caller', SOURCES, 'filter source'),
  };
  if (node.kind === 'aggregate') return {
    $type: 'aggregate', collectionFieldId: node.collectionFieldId, aggregate: ordinal(node.aggregate, AGGREGATES, 'filter aggregate'),
    ...(node.aggregateFieldId ? { aggregateFieldId: node.aggregateFieldId } : {}),
    ...(node.resultOperator ? { resultOperator: ordinal(node.resultOperator, OPERATORS, 'result operator') } : {}),
    ...(node.nestedCriteria ? { nested: encodeFilterNode(node.nestedCriteria)! } : {}),
    values: node.values.map(encodeValue), source: ordinal(node.source ?? 'caller', SOURCES, 'filter source'),
  };
  throw new CgFilterCodecError('Unknown filter node type');
}

export function serializeFilterNode(node: CgFilterNode | null): string { return JSON.stringify(encodeFilterNode(node)); }
export function deserializeFilterNode(json: string, limits?: CgFilterLimits): CgFilterNode | null {
  try { return decodeFilterNode(JSON.parse(json) as unknown, limits); }
  catch (error) { if (error instanceof CgFilterCodecError) throw error; throw new CgFilterCodecError('Filter payload is not valid JSON'); }
}

export const CG_FILTER_OPERATOR_ORDINALS = Object.freeze(Object.fromEntries(OPERATORS.map((operator, index) => [operator, index])) as Record<CgFilterOperator, number>);
export const CG_FILTER_VALUE_KIND_ORDINALS = Object.freeze(Object.fromEntries(VALUE_KINDS.map((kind, index) => [kind, index])) as Record<CgFilterValueKind, number>);
