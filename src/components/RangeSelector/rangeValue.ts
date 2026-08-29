import {
  civilToDayNumber,
  dayNumberToCivil,
  parseCanonicalDate,
  toCanonicalDate,
} from '../../internal/date/dateMath';
import type { CgDateValue } from '../../types';
import type {
  CgDecimalValue,
  CgInstantValue,
  CgLocalDateTimeValue,
  CgRangeHandle,
  CgRangeSelectorValue,
} from './CgRangeSelector.types';

export type RangeKind = 'number' | 'bigint' | 'decimal' | 'date' | 'datetime-local' | 'instant';
export type RangePublicValue = number | bigint | CgDecimalValue | CgDateValue | CgLocalDateTimeValue | CgInstantValue;
export type RangeWire = number | bigint;

const DAY_MILLISECONDS = 86_400_000n;
const RATIO_SCALE = 1_000_000_000n;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/u;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|z|[+-]\d{2}:\d{2})$/u;
const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/u;

interface DecimalParts { readonly coefficient: bigint; readonly scale: number }
interface CivilTimeParts {
  readonly day: bigint;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}
interface InstantParts extends CivilTimeParts {
  readonly offsetMinutes: number;
  readonly offsetToken: string;
}

export interface RangeModel {
  readonly kind: RangeKind;
  readonly exact: boolean;
  readonly minimum: RangeWire;
  readonly maximum: RangeWire;
  readonly start: RangeWire;
  readonly end: RangeWire;
  readonly step: RangeWire;
  readonly minimumSpan: RangeWire | null;
  readonly maximumSpan: RangeWire | null;
  readonly minimumPublic: RangePublicValue;
  readonly maximumPublic: RangePublicValue;
  readonly resolvedStartPublic: RangePublicValue;
  readonly resolvedEndPublic: RangePublicValue;
  readonly value: CgRangeSelectorValue<RangePublicValue>;
  readonly scale: number;
  readonly instantOffsetMinutes: number;
  readonly instantOffsetToken: string;
  readonly key: string;
  readonly fromWire: (wire: RangeWire) => RangePublicValue;
  readonly wireText: (wire: RangeWire) => string;
  readonly proposal: (start: RangeWire, end: RangeWire) => CgRangeSelectorValue<RangePublicValue>;
}

export interface RangeModelConfiguration {
  readonly kind: RangeKind;
  readonly minimum: RangePublicValue;
  readonly maximum: RangePublicValue;
  readonly value: CgRangeSelectorValue<RangePublicValue>;
  readonly step?: RangePublicValue | number;
  readonly minimumSelectionSpan?: RangePublicValue | number;
  readonly maximumSelectionSpan?: RangePublicValue | number;
  readonly snapToStep: boolean;
}

function fail(message: string): never {
  throw new RangeError(`CgRangeSelector ${message}`);
}

function decimalParts(value: string): DecimalParts {
  const match = DECIMAL.exec(value);
  if (!match) fail(`decimal value "${value}" is invalid.`);
  const fraction = match[3] ?? '';
  const coefficient = BigInt(`${match[2]}${fraction}`) * (match[1] === '-' ? -1n : 1n);
  return { coefficient, scale: fraction.length };
}

function decimalText(coefficient: bigint, scale: number): string {
  if (coefficient === 0n) return '0';
  const negative = coefficient < 0n;
  let digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  if (scale > 0) {
    const split = digits.length - scale;
    digits = `${digits.slice(0, split)}.${digits.slice(split)}`.replace(/\.?0+$/u, '');
  }
  return `${negative ? '-' : ''}${digits}`;
}

export function normalizeCgDecimalValue(input: string): CgDecimalValue {
  const value = input.trim();
  const match = DECIMAL.exec(value);
  if (!match) fail('decimal values must use base-10 notation without an exponent.');
  const integer = (match[2] ?? '').replace(/^0+(?=\d)/u, '') || '0';
  const fraction = (match[3] ?? '').replace(/0+$/u, '');
  const zero = /^0+$/u.test(integer) && fraction.length === 0;
  return `${match[1] === '-' && !zero ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}` as CgDecimalValue;
}

function parseCivilTime(match: RegExpExecArray): CivilTimeParts {
  const date = parseCanonicalDate(match[1] ?? '');
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] ?? 0);
  const millisecond = Number((match[5] ?? '').padEnd(3, '0') || 0);
  if (!date || hour > 23 || minute > 59 || second > 59) fail('temporal value is outside the supported civil calendar or clock range.');
  return { day: BigInt(civilToDayNumber(date)), hour, minute, second, millisecond };
}

function civilTimeText(parts: CivilTimeParts): string {
  const date = toCanonicalDate(dayNumberToCivil(Number(parts.day)));
  return `${date}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}.${String(parts.millisecond).padStart(3, '0')}`;
}

export function normalizeCgLocalDateTimeValue(input: string): CgLocalDateTimeValue {
  const match = LOCAL_DATE_TIME.exec(input.trim());
  if (!match) fail('local date-time values must use ISO civil date and time notation without an offset.');
  return civilTimeText(parseCivilTime(match)) as CgLocalDateTimeValue;
}

function parseInstant(input: string): InstantParts {
  const match = INSTANT.exec(input);
  if (!match) fail('instant values must use ISO date-time notation with Z or an explicit offset.');
  const civil = parseCivilTime(match);
  const rawToken = match[6] ?? '';
  const offsetToken = rawToken.toUpperCase() === 'Z' ? 'Z' : rawToken;
  let offsetMinutes = 0;
  if (offsetToken !== 'Z') {
    const sign = offsetToken[0] === '-' ? -1 : 1;
    const hour = Number(offsetToken.slice(1, 3));
    const minute = Number(offsetToken.slice(4, 6));
    if (hour > 14 || minute > 59 || hour === 14 && minute !== 0) fail('instant offsets must be between -14:00 and +14:00.');
    offsetMinutes = sign * (hour * 60 + minute);
  }
  return { ...civil, offsetMinutes, offsetToken };
}

export function normalizeCgInstantValue(input: string): CgInstantValue {
  const parts = parseInstant(input.trim());
  return `${civilTimeText(parts)}${parts.offsetToken}` as CgInstantValue;
}

function civilMilliseconds(parts: CivilTimeParts): bigint {
  return parts.day * DAY_MILLISECONDS
    + BigInt(parts.hour * 3_600_000 + parts.minute * 60_000 + parts.second * 1_000 + parts.millisecond);
}

function floorDiv(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  const remainder = value % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

function civilFromMilliseconds(value: bigint): CivilTimeParts {
  const day = floorDiv(value, DAY_MILLISECONDS);
  const dayNumber = Number(day);
  const date = dayNumberToCivil(dayNumber);
  if (date.year < 1 || date.year > 9999) fail('generated temporal value is outside 0001-01-01 through 9999-12-31.');
  let remaining = value - day * DAY_MILLISECONDS;
  const hour = Number(remaining / 3_600_000n); remaining %= 3_600_000n;
  const minute = Number(remaining / 60_000n); remaining %= 60_000n;
  const second = Number(remaining / 1_000n);
  const millisecond = Number(remaining % 1_000n);
  return { day, hour, minute, second, millisecond };
}

function assertNormalized<T extends string>(value: T, normalize: (input: string) => T, name: string): T {
  const normalized = normalize(value);
  if (normalized !== value) fail(`${name} must be normalized as "${normalized}".`);
  return value;
}

function assertFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${name} must be a finite number.`);
  return value;
}

function assertSafePositiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) fail(`${name} must be a positive safe integer.`);
  return value;
}

function freezeValue<T>(value: CgRangeSelectorValue<T>): CgRangeSelectorValue<T> {
  return Object.freeze({ start: value.start, end: value.end });
}

function sameWire(left: RangeWire, right: RangeWire): boolean {
  return left === right;
}

function compare(left: RangeWire, right: RangeWire): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function wireAdd(left: RangeWire, right: RangeWire): RangeWire {
  return typeof left === 'bigint' ? left + BigInt(right) : left + Number(right);
}

export function wireSubtract(left: RangeWire, right: RangeWire): RangeWire {
  return typeof left === 'bigint' ? left - BigInt(right) : left - Number(right);
}

export function wireMultiply(value: RangeWire, factor: number): RangeWire {
  return typeof value === 'bigint' ? value * BigInt(factor) : stabilize(value * factor);
}

export function wireNegate(value: RangeWire): RangeWire {
  return typeof value === 'bigint' ? -value : -value;
}

export function wireCompare(left: RangeWire, right: RangeWire): number {
  return compare(left, right);
}

export function wireClamp(value: RangeWire, minimum: RangeWire, maximum: RangeWire): RangeWire {
  if (compare(value, minimum) < 0) return minimum;
  if (compare(value, maximum) > 0) return maximum;
  return value;
}

function stabilize(value: number): number {
  return Number.parseFloat(value.toPrecision(15));
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return value <= 0n ? value / divisor : (value + divisor - 1n) / divisor;
}

function validateReachability(model: Pick<RangeModel, 'exact' | 'minimum' | 'maximum' | 'step' | 'minimumSpan' | 'maximumSpan'>): void {
  const domain = wireSubtract(model.maximum, model.minimum);
  const lower = model.minimumSpan ?? (model.exact ? 0n : 0);
  const upper = model.maximumSpan ?? domain;
  if (model.exact) {
    const step = model.step as bigint;
    const first = ceilDiv(lower as bigint, step) * step;
    const domainReachable = compare(domain, lower) >= 0 && compare(domain, upper) <= 0;
    if (!domainReachable && (compare(first, upper) > 0 || compare(first, domain) > 0)) {
      fail('step and span constraints leave no reachable selection.');
    }
    return;
  }
  const step = model.step as number;
  const first = Math.ceil(((lower as number) / step) - 1e-12) * step;
  const domainReachable = (domain as number) + 1e-12 >= (lower as number) && (domain as number) - 1e-12 <= (upper as number);
  if (!domainReachable && (first > (upper as number) + 1e-12 || first > (domain as number) + 1e-12)) {
    fail('step and span constraints leave no reachable selection.');
  }
}

export function createRangeModel(configuration: RangeModelConfiguration): RangeModel {
  const { kind } = configuration;
  const rawValues = [configuration.minimum, configuration.maximum, configuration.value.start, configuration.value.end]
    .filter((value): value is RangePublicValue => value !== null);
  const rawIntervals = [configuration.step, configuration.minimumSelectionSpan, configuration.maximumSelectionSpan]
    .filter((value): value is RangePublicValue | number => value !== undefined);

  let scale = 0;
  let instantOffsetMinutes = 0;
  let instantOffsetToken = 'Z';
  if (kind === 'decimal') {
    const strings = [...rawValues, ...rawIntervals].map((value) => {
      if (typeof value !== 'string') fail('decimal values and intervals must be normalized decimal strings.');
      return assertNormalized(value as CgDecimalValue, normalizeCgDecimalValue, 'decimal value');
    });
    scale = Math.max(0, ...strings.map((value) => decimalParts(value).scale));
  }
  if (kind === 'instant') {
    const minimum = assertNormalized(configuration.minimum as CgInstantValue, normalizeCgInstantValue, 'minimum instant');
    const parts = parseInstant(minimum);
    instantOffsetMinutes = parts.offsetMinutes;
    instantOffsetToken = parts.offsetToken;
  }

  const toWire = (raw: RangePublicValue, name: string): RangeWire => {
    if (kind === 'number') return assertFiniteNumber(raw, name);
    if (kind === 'bigint') {
      if (typeof raw !== 'bigint') fail(`${name} must be a bigint.`);
      return raw;
    }
    if (kind === 'decimal') {
      if (typeof raw !== 'string') fail(`${name} must be a normalized decimal string.`);
      const normalized = assertNormalized(raw as CgDecimalValue, normalizeCgDecimalValue, name);
      const parts = decimalParts(normalized);
      return parts.coefficient * (10n ** BigInt(scale - parts.scale));
    }
    if (kind === 'date') {
      if (typeof raw !== 'string') fail(`${name} must be a canonical date.`);
      const date = parseCanonicalDate(raw);
      if (!date || toCanonicalDate(date) !== raw) fail(`${name} must use canonical YYYY-MM-DD form.`);
      return BigInt(civilToDayNumber(date));
    }
    if (kind === 'datetime-local') {
      if (typeof raw !== 'string') fail(`${name} must be a normalized local date-time.`);
      const normalized = assertNormalized(raw as CgLocalDateTimeValue, normalizeCgLocalDateTimeValue, name);
      const match = LOCAL_DATE_TIME.exec(normalized);
      return civilMilliseconds(parseCivilTime(match!));
    }
    if (typeof raw !== 'string') fail(`${name} must be a normalized instant.`);
    const normalized = assertNormalized(raw as CgInstantValue, normalizeCgInstantValue, name);
    const parts = parseInstant(normalized);
    return civilMilliseconds(parts) - BigInt(parts.offsetMinutes) * 60_000n;
  };

  const intervalWire = (raw: RangePublicValue | number | undefined, name: string): RangeWire => {
    if (raw === undefined) {
      if (kind === 'datetime-local' || kind === 'instant') return DAY_MILLISECONDS;
      return kind === 'number' ? 1 : 1n;
    }
    if (kind === 'number') {
      const value = assertFiniteNumber(raw, name);
      if (value <= 0) fail(`${name} must be greater than zero.`);
      return value;
    }
    if (kind === 'bigint') {
      if (typeof raw !== 'bigint' || raw <= 0n) fail(`${name} must be a positive bigint.`);
      return raw;
    }
    if (kind === 'decimal') {
      const value = toWire(raw, name) as bigint;
      if (value <= 0n) fail(`${name} must be greater than zero.`);
      return value;
    }
    const value = assertSafePositiveInteger(raw, name);
    return BigInt(value);
  };

  const minimumPublic = configuration.minimum;
  const maximumPublic = configuration.maximum;
  const minimum = toWire(minimumPublic, 'minimum');
  const maximum = toWire(maximumPublic, 'maximum');
  if (compare(minimum, maximum) >= 0) fail('minimum must be strictly less than maximum.');

  const value = freezeValue(configuration.value);
  const resolvedStartPublic = value.start ?? minimumPublic;
  const resolvedEndPublic = value.end ?? maximumPublic;
  const start = toWire(resolvedStartPublic, 'start value');
  const end = toWire(resolvedEndPublic, 'end value');
  const step = intervalWire(configuration.step, 'step');
  const minimumSpan = configuration.minimumSelectionSpan === undefined
    ? null : intervalWire(configuration.minimumSelectionSpan, 'minimumSelectionSpan');
  const maximumSpan = configuration.maximumSelectionSpan === undefined
    ? null : intervalWire(configuration.maximumSelectionSpan, 'maximumSelectionSpan');
  const domain = wireSubtract(maximum, minimum);
  if (minimumSpan !== null && compare(minimumSpan, domain) > 0) fail('minimumSelectionSpan cannot exceed the domain.');
  if (maximumSpan !== null && compare(maximumSpan, domain) > 0) fail('maximumSelectionSpan cannot exceed the domain.');
  if (minimumSpan !== null && maximumSpan !== null && compare(minimumSpan, maximumSpan) > 0) {
    fail('minimumSelectionSpan cannot exceed maximumSelectionSpan.');
  }
  if (compare(start, minimum) < 0 || compare(start, maximum) > 0 || compare(end, minimum) < 0 || compare(end, maximum) > 0) {
    fail('external values must stay within minimum and maximum.');
  }
  if (compare(start, end) > 0) fail('external values must be ordered from start to end.');
  const selectedSpan = wireSubtract(end, start);
  if (minimumSpan !== null && compare(selectedSpan, minimumSpan) < 0) fail('external values violate minimumSelectionSpan.');
  if (maximumSpan !== null && compare(selectedSpan, maximumSpan) > 0) fail('external values violate maximumSelectionSpan.');

  const fromWire = (wire: RangeWire): RangePublicValue => {
    if (kind === 'number') return wire;
    if (kind === 'bigint') return wire;
    if (kind === 'decimal') return decimalText(wire as bigint, scale);
    if (kind === 'date') return toCanonicalDate(dayNumberToCivil(Number(wire)));
    if (kind === 'datetime-local') return civilTimeText(civilFromMilliseconds(wire as bigint));
    const local = (wire as bigint) + BigInt(instantOffsetMinutes) * 60_000n;
    return `${civilTimeText(civilFromMilliseconds(local))}${instantOffsetToken}` as CgInstantValue;
  };
  // Ensure the complete instant domain can be represented in the retained minimum offset.
  if (kind === 'instant') { fromWire(minimum); fromWire(maximum); }

  const wireText = (wire: RangeWire): string => kind === 'decimal'
    ? decimalText(wire as bigint, scale)
    : typeof wire === 'bigint' ? wire.toString() : String(stabilize(wire));

  const proposal = (nextStart: RangeWire, nextEnd: RangeWire): CgRangeSelectorValue<RangePublicValue> => {
    const proposedStart = sameWire(nextStart, minimum)
      ? null
      : sameWire(nextStart, start) && value.start !== null ? value.start : fromWire(nextStart);
    const proposedEnd = sameWire(nextEnd, maximum)
      ? null
      : sameWire(nextEnd, end) && value.end !== null ? value.end : fromWire(nextEnd);
    return freezeValue({ start: proposedStart, end: proposedEnd });
  };

  const model: RangeModel = {
    kind,
    exact: kind !== 'number',
    minimum,
    maximum,
    start,
    end,
    step,
    minimumSpan,
    maximumSpan,
    minimumPublic,
    maximumPublic,
    resolvedStartPublic,
    resolvedEndPublic,
    value,
    scale,
    instantOffsetMinutes,
    instantOffsetToken,
    key: [kind, wireText(minimum), wireText(maximum), wireText(start), wireText(end), wireText(step), minimumSpan === null ? '' : wireText(minimumSpan), maximumSpan === null ? '' : wireText(maximumSpan), String(value.start === null), String(value.end === null), String(configuration.snapToStep)].join('|'),
    fromWire,
    wireText,
    proposal,
  };
  if (configuration.snapToStep) validateReachability(model);
  return Object.freeze(model);
}

export function rangeRatio(model: RangeModel, value: RangeWire): number {
  const numerator = wireSubtract(value, model.minimum);
  const denominator = wireSubtract(model.maximum, model.minimum);
  if (model.exact) {
    const scaled = ((numerator as bigint) * RATIO_SCALE) / (denominator as bigint);
    return Math.min(1, Math.max(0, Number(scaled) / Number(RATIO_SCALE)));
  }
  return Math.min(1, Math.max(0, (numerator as number) / (denominator as number)));
}

export function rangeValueFromRatio(model: RangeModel, ratio: number): RangeWire {
  const bounded = Math.min(1, Math.max(0, ratio));
  const domain = wireSubtract(model.maximum, model.minimum);
  if (model.exact) {
    const scaled = BigInt(Math.round(bounded * Number(RATIO_SCALE)));
    return (model.minimum as bigint) + ((domain as bigint) * scaled) / RATIO_SCALE;
  }
  return stabilize((model.minimum as number) + (domain as number) * bounded);
}

function roundToStepExact(offset: bigint, step: bigint): bigint {
  const sign = offset < 0n ? -1n : 1n;
  const magnitude = offset * sign;
  return sign * ((magnitude + step / 2n) / step) * step;
}

export function snapRangeValue(model: RangeModel, value: RangeWire): RangeWire {
  const offset = wireSubtract(value, model.minimum);
  const snapped = model.exact
    ? (model.minimum as bigint) + roundToStepExact(offset as bigint, model.step as bigint)
    : stabilize((model.minimum as number) + Math.round((offset as number) / (model.step as number)) * (model.step as number));
  return wireClamp(snapped, model.minimum, model.maximum);
}

export function snapRangeDelta(model: RangeModel, value: RangeWire): RangeWire {
  return model.exact
    ? roundToStepExact(value as bigint, model.step as bigint)
    : stabilize(Math.round((value as number) / (model.step as number)) * (model.step as number));
}

function floorToStep(model: RangeModel, value: RangeWire): RangeWire {
  const offset = wireSubtract(value, model.minimum);
  if (model.exact) return (model.minimum as bigint) + (offset as bigint) / (model.step as bigint) * (model.step as bigint);
  return stabilize((model.minimum as number) + Math.floor((offset as number) / (model.step as number) + 1e-12) * (model.step as number));
}

function ceilToStep(model: RangeModel, value: RangeWire): RangeWire {
  const offset = wireSubtract(value, model.minimum);
  if (model.exact) return (model.minimum as bigint) + ceilDiv(offset as bigint, model.step as bigint) * (model.step as bigint);
  return stabilize((model.minimum as number) + Math.ceil((offset as number) / (model.step as number) - 1e-12) * (model.step as number));
}

export function rangeHandleBounds(
  model: RangeModel,
  values: { readonly start: RangeWire; readonly end: RangeWire },
  handle: CgRangeHandle,
): { readonly minimum: RangeWire; readonly maximum: RangeWire } {
  if (handle === 'start') {
    let minimum = model.minimum;
    let maximum = values.end;
    if (model.maximumSpan !== null) minimum = wireClamp(wireSubtract(values.end, model.maximumSpan), minimum, maximum);
    if (model.minimumSpan !== null) maximum = wireClamp(wireSubtract(values.end, model.minimumSpan), minimum, maximum);
    return { minimum, maximum };
  }
  let minimum = values.start;
  let maximum = model.maximum;
  if (model.minimumSpan !== null) minimum = wireClamp(wireAdd(values.start, model.minimumSpan), minimum, maximum);
  if (model.maximumSpan !== null) maximum = wireClamp(wireAdd(values.start, model.maximumSpan), minimum, maximum);
  return { minimum, maximum };
}

function boundedCandidate(model: RangeModel, candidate: RangeWire, minimum: RangeWire, maximum: RangeWire, snap: boolean): RangeWire {
  if (!snap) return wireClamp(candidate, minimum, maximum);
  const snapped = snapRangeValue(model, candidate);
  const gridMinimum = ceilToStep(model, minimum);
  const gridMaximum = floorToStep(model, maximum);
  return compare(gridMinimum, gridMaximum) <= 0
    ? wireClamp(snapped, gridMinimum, gridMaximum)
    : wireClamp(candidate, minimum, maximum);
}

export function moveRangeHandle(
  model: RangeModel,
  origin: { readonly start: RangeWire; readonly end: RangeWire },
  requestedHandle: CgRangeHandle,
  rawCandidate: RangeWire,
  allowSwap: boolean,
  snap: boolean,
): { readonly start: RangeWire; readonly end: RangeWire; readonly handle: CgRangeHandle } {
  let handle = requestedHandle;
  let start = origin.start;
  let end = origin.end;
  let candidate = wireClamp(rawCandidate, model.minimum, model.maximum);
  if (requestedHandle === 'start' && compare(candidate, end) > 0) {
    if (allowSwap) { start = end; end = candidate; handle = 'end'; }
    else candidate = end;
  } else if (requestedHandle === 'end' && compare(candidate, start) < 0) {
    if (allowSwap) { end = start; start = candidate; handle = 'start'; }
    else candidate = start;
  }
  const bounds = rangeHandleBounds(model, { start, end }, handle);
  if (handle === 'start') start = boundedCandidate(model, candidate, bounds.minimum, bounds.maximum, snap);
  else end = boundedCandidate(model, candidate, bounds.minimum, bounds.maximum, snap);
  return Object.freeze({ start, end, handle });
}

export function moveCompleteRange(
  model: RangeModel,
  origin: { readonly start: RangeWire; readonly end: RangeWire },
  rawDelta: RangeWire,
  snap: boolean,
): { readonly start: RangeWire; readonly end: RangeWire } {
  let delta = snap ? snapRangeDelta(model, rawDelta) : rawDelta;
  delta = wireClamp(delta, wireSubtract(model.minimum, origin.start), wireSubtract(model.maximum, origin.end));
  return Object.freeze({ start: wireAdd(origin.start, delta), end: wireAdd(origin.end, delta) });
}

export function centerRangeAt(
  model: RangeModel,
  origin: { readonly start: RangeWire; readonly end: RangeWire },
  center: RangeWire,
  snap: boolean,
): { readonly start: RangeWire; readonly end: RangeWire } {
  const span = wireSubtract(origin.end, origin.start);
  const half = typeof span === 'bigint' ? span / 2n : span / 2;
  const currentCenter = wireAdd(origin.start, half);
  return moveCompleteRange(model, origin, wireSubtract(center, currentCenter), snap);
}
