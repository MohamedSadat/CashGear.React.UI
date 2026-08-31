import {
  addDays,
  addMonths,
  addYears,
  civilToDayNumber,
  dayNumberToCivil,
  daysFromWeekStart,
} from '../../internal/date/dateMath';
import type { CgChartValueAxisDescriptor } from './CgChart.types';
import {
  exactAdd,
  exactCompare,
  exactFromNumeric,
  exactFromScaledInteger,
  exactMultiplyInteger,
  exactSubtract,
} from './chartValues';
import type { ExactValue, TemporalKind } from './chartValues';

const DAY_MS = 86_400_000n;
const MAX_TICKS = 64;

export interface NumericDomain {
  readonly minimum: ExactValue;
  readonly maximum: ExactValue;
  readonly interval: ExactValue;
  readonly ticks: ReadonlyArray<ExactValue>;
}

function scientific(value: ExactValue): Readonly<{ mantissa: number; exponent: number }> {
  const digits = (value.coefficient < 0n ? -value.coefficient : value.coefficient).toString();
  if (value.coefficient === 0n) return { mantissa: 0, exponent: 0 };
  const significant = Number(digits.slice(0, 15)) / 10 ** (Math.min(15, digits.length) - 1);
  return { mantissa: significant, exponent: digits.length - value.scale - 1 };
}

function niceInterval(span: ExactValue, maximumTicks: number): ExactValue {
  const { mantissa, exponent: spanExponent } = scientific(span);
  let raw = mantissa / Math.max(1, maximumTicks - 1);
  let exponent = spanExponent;
  while (raw < 1) { raw *= 10; exponent--; }
  while (raw >= 10) { raw /= 10; exponent++; }
  let nice = raw <= 1 ? 1 : raw <= 2 ? 2 : raw <= 5 ? 5 : 10;
  if (nice === 10) { nice = 1; exponent++; }
  return exponent >= 0
    ? exactFromScaledInteger(BigInt(nice) * 10n ** BigInt(exponent), 0)
    : exactFromScaledInteger(BigInt(nice), -exponent);
}

function floorDiv(value: bigint, divisor: bigint): bigint {
  const quotient = value / divisor;
  return value % divisor < 0n ? quotient - 1n : quotient;
}

function alignedQuotient(value: ExactValue, step: ExactValue, ceiling: boolean): bigint {
  const scale = Math.max(value.scale, step.scale);
  const numerator = value.coefficient * 10n ** BigInt(scale - value.scale);
  const denominator = step.coefficient * 10n ** BigInt(scale - step.scale);
  const floor = floorDiv(numerator, denominator);
  return ceiling && floor * denominator !== numerator ? floor + 1n : floor;
}

export function createNumericDomain(
  values: ReadonlyArray<ExactValue>,
  axis: CgChartValueAxisDescriptor | undefined,
  includeZero: boolean,
  maximumTicks = 7,
): NumericDomain {
  let minimum = values[0] ?? exactFromNumeric(0);
  let maximum = minimum;
  for (const value of values.slice(1)) {
    if (exactCompare(value, minimum) < 0) minimum = value;
    if (exactCompare(value, maximum) > 0) maximum = value;
  }
  if (includeZero) {
    const zero = exactFromNumeric(0);
    if (exactCompare(zero, minimum) < 0) minimum = zero;
    if (exactCompare(zero, maximum) > 0) maximum = zero;
  }
  if (axis?.minimum !== undefined) minimum = exactFromNumeric(axis.minimum);
  if (axis?.maximum !== undefined) maximum = exactFromNumeric(axis.maximum);
  if (exactCompare(minimum, maximum) === 0) {
    const padding = minimum.coefficient === 0n
      ? exactFromNumeric(1)
      : niceInterval({ coefficient: minimum.coefficient < 0n ? -minimum.coefficient : minimum.coefficient, scale: minimum.scale }, 20);
    minimum = exactSubtract(minimum, padding);
    maximum = exactAdd(maximum, padding);
  }

  const span = exactSubtract(maximum, minimum);
  const interval = axis?.tickInterval === undefined ? niceInterval(span, maximumTicks) : exactFromNumeric(axis.tickInterval);
  const niceMinimum = axis?.minimum === undefined
    ? exactMultiplyInteger(interval, alignedQuotient(minimum, interval, false))
    : minimum;
  const niceMaximum = axis?.maximum === undefined
    ? exactMultiplyInteger(interval, alignedQuotient(maximum, interval, true))
    : maximum;
  const ticks: ExactValue[] = [];
  for (let index = 0; index < MAX_TICKS; index++) {
    const tick = exactAdd(niceMinimum, exactMultiplyInteger(interval, BigInt(index)));
    if (exactCompare(tick, niceMaximum) > 0) break;
    ticks.push(tick);
  }
  return Object.freeze({
    minimum: niceMinimum,
    maximum: niceMaximum,
    interval,
    ticks: Object.freeze(ticks.length ? ticks : [niceMinimum]),
  });
}

export type DateTickUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface DateDomain {
  readonly minimum: bigint;
  readonly maximum: bigint;
  readonly unit: DateTickUnit;
  readonly step: number;
  readonly ticks: ReadonlyArray<bigint>;
}

const FIXED_CANDIDATES: ReadonlyArray<readonly [DateTickUnit, number, bigint]> = [
  ['millisecond', 1, 1n], ['millisecond', 10, 10n], ['millisecond', 100, 100n],
  ['second', 1, 1_000n], ['second', 5, 5_000n], ['second', 15, 15_000n], ['second', 30, 30_000n],
  ['minute', 1, 60_000n], ['minute', 5, 300_000n], ['minute', 15, 900_000n], ['minute', 30, 1_800_000n],
  ['hour', 1, 3_600_000n], ['hour', 3, 10_800_000n], ['hour', 6, 21_600_000n], ['hour', 12, 43_200_000n],
  ['day', 1, DAY_MS], ['day', 2, DAY_MS * 2n], ['week', 1, DAY_MS * 7n], ['week', 2, DAY_MS * 14n],
];

function localeFirstDay(locale: string): number {
  const info = (new Intl.Locale(locale) as Intl.Locale & { readonly weekInfo: { readonly firstDay: number } }).weekInfo;
  return info.firstDay % 7;
}

function calendarTickValues(minimum: bigint, maximum: bigint, unit: DateTickUnit, step: number, firstDay: number): bigint[] {
  const dayNumber = Number(minimum / DAY_MS);
  let date = dayNumberToCivil(dayNumber);
  if (unit === 'week') date = addDays(date, -daysFromWeekStart(date, firstDay));
  else if (unit === 'month') date = { year: date.year, month: date.month, day: 1 };
  else if (unit === 'quarter') date = { year: date.year, month: Math.floor((date.month - 1) / 3) * 3 + 1, day: 1 };
  else if (unit === 'year') date = { year: date.year, month: 1, day: 1 };
  const ticks: bigint[] = [];
  for (let guard = 0; guard < MAX_TICKS; guard++) {
    const tick = BigInt(civilToDayNumber(date)) * DAY_MS;
    if (tick >= minimum && tick <= maximum) ticks.push(tick);
    if (tick > maximum) break;
    date = unit === 'week' ? addDays(date, 7 * step)
      : unit === 'month' ? addMonths(date, step)
        : unit === 'quarter' ? addMonths(date, 3 * step)
          : addYears(date, step);
  }
  return ticks;
}

export function createDateDomain(
  minimum: bigint,
  maximum: bigint,
  maximumTicks: number,
  locale: string,
  _kind: TemporalKind,
  explicitInterval?: bigint,
): DateDomain {
  if (minimum > maximum) [minimum, maximum] = [maximum, minimum];
  if (minimum === maximum) { minimum -= DAY_MS; maximum += DAY_MS; }
  if (explicitInterval !== undefined) {
    if (explicitInterval <= 0n) throw new RangeError('CgChart date tick interval must be positive.');
    const first = alignedQuotient(
      { coefficient: minimum, scale: 0 },
      { coefficient: explicitInterval, scale: 0 },
      true,
    ) * explicitInterval;
    const ticks: bigint[] = [];
    for (let index = 0; index < MAX_TICKS; index++) {
      const tick = first + BigInt(index) * explicitInterval;
      if (tick > maximum) break;
      ticks.push(tick);
    }
    return Object.freeze({ minimum, maximum, unit: 'millisecond', step: Number(explicitInterval <= BigInt(Number.MAX_SAFE_INTEGER) ? explicitInterval : 1n), ticks: Object.freeze(ticks) });
  }
  const span = maximum - minimum;
  let chosen: readonly [DateTickUnit, number, bigint] | null = null;
  for (const candidate of FIXED_CANDIDATES) {
    if (span / candidate[2] + 1n <= BigInt(Math.max(2, maximumTicks))) { chosen = candidate; break; }
  }
  if (chosen) {
    const first = floorDiv(minimum, chosen[2]) * chosen[2];
    const ticks: bigint[] = [];
    for (let index = 0; index < MAX_TICKS; index++) {
      const tick = first + BigInt(index) * chosen[2];
      if (tick > maximum) break;
      if (tick >= minimum) ticks.push(tick);
    }
    return Object.freeze({ minimum, maximum, unit: chosen[0], step: chosen[1], ticks: Object.freeze(ticks) });
  }
  const days = Number(span / DAY_MS);
  const calendar: readonly [DateTickUnit, number] = days <= 540 ? ['month', 1]
    : days <= 1_200 ? ['quarter', 1]
      : days <= 3_650 ? ['year', 1]
        : days <= 18_250 ? ['year', 5] : ['year', 25];
  const ticks = calendarTickValues(minimum, maximum, calendar[0], calendar[1], localeFirstDay(locale));
  return Object.freeze({ minimum, maximum, unit: calendar[0], step: calendar[1], ticks: Object.freeze(ticks) });
}
