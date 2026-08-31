import type {
  CgChartArgumentAxisDescriptor,
  CgChartNumericValue,
  CgChartPointLabelOptions,
  CgChartPointRef,
  CgChartStrings,
  CgChartTooltipOptions,
  CgChartValueAxisDescriptor,
} from './CgChart.types';
import {
  exactCompare,
  exactFromNumeric,
  exactText,
  temporalParts,
} from './chartValues';
import type { ExactValue, NormalizedArgument, TemporalKind } from './chartValues';

interface ExactIntlNumberFormat extends Intl.NumberFormat {
  format(value: number | bigint | string): string;
}

export const DEFAULT_CHART_STRINGS: CgChartStrings = Object.freeze({
  chartAriaLabel: 'Chart',
  seriesRoleDescription: 'series',
  pointRoleDescription: 'data point',
  noData: 'No data to display',
  loading: 'Loading chart data',
  noValue: 'no data',
  tooSmall: 'Not enough room to draw this chart',
  dataTableSummary: 'Chart data',
  dataTableToggle: 'Chart data',
  argumentColumnHeader: 'Category',
  percentageColumnHeader: 'Percentage',
  legendAriaLabel: 'Chart series',
  thousandSuffix: 'K',
  millionSuffix: 'M',
  billionSuffix: 'B',
  seriesShownTemplate: '{series} shown',
  seriesHiddenTemplate: '{series} hidden',
  pointSelectedTemplate: '{series}, {argument}, {value} selected',
  selectionCleared: 'Selection cleared',
  pointLabelTemplate: '{series}, {argument}, {value}',
  seriesLabelTemplate: '{series}, {count} points',
  keyboardInstructions: 'Use the left and right arrow keys to move between data points, up and down to change series, Enter or Space to activate, and Escape to dismiss the tooltip.',
});

export function resolveChartStrings(overrides?: Partial<CgChartStrings>): CgChartStrings {
  return Object.freeze({ ...DEFAULT_CHART_STRINGS, ...overrides });
}

export function chartMessage(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([a-z]+)\}/giu, (token, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token
  ));
}

function numberFormatter(locale: string, options: Readonly<Intl.NumberFormatOptions>): ExactIntlNumberFormat {
  return new Intl.NumberFormat(locale, { ...options });
}

function dateAtUtc(parts: ReturnType<typeof temporalParts>): Date {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date;
}

function instantDate(argument: NormalizedArgument): Date {
  const milliseconds = Number(argument.epochMilliseconds);
  if (!Number.isFinite(milliseconds)) throw new RangeError('CgChart instant is outside the JavaScript Intl range.');
  return new Date(milliseconds);
}

export interface ChartFormatter {
  readonly locale: string;
  readonly displayTimeZone: string;
  readonly strings: CgChartStrings;
  formatArgument(argument: NormalizedArgument, axis?: CgChartArgumentAxisDescriptor): string;
  formatDateTick(epochMilliseconds: bigint, kind: TemporalKind, axis?: CgChartArgumentAxisDescriptor): string;
  formatValue(value: CgChartNumericValue, options?: Readonly<Intl.NumberFormatOptions>): string;
  formatAxisValue(value: ExactValue, axis: CgChartValueAxisDescriptor | undefined, interval?: ExactValue): string;
  formatPercentage(ratio: number): string;
  formatTooltipValue(value: CgChartNumericValue, point: CgChartPointRef, options?: CgChartTooltipOptions): string;
  formatPointLabel(value: CgChartNumericValue, point: CgChartPointRef, options?: CgChartPointLabelOptions): string;
}

function defaultValueOptions(value: CgChartNumericValue): Intl.NumberFormatOptions {
  if (typeof value === 'bigint') return { maximumFractionDigits: 0 };
  if (typeof value === 'string') return { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return Number.isInteger(value)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
}

function decimalPlaces(value: ExactValue): number {
  return Math.min(12, Math.max(0, value.scale));
}

function dividePower(value: ExactValue, power: number): string {
  return exactText({ coefficient: value.coefficient, scale: value.scale + power });
}

export function createChartFormatter(
  locale: string,
  displayTimeZone: string,
  strings: CgChartStrings,
): ChartFormatter {
  // Eager construction rejects malformed locale/zone configuration during render, before the
  // chart has emitted a misleading partially formatted model.
  new Intl.NumberFormat(locale).format(0);
  new Intl.DateTimeFormat(locale, { timeZone: displayTimeZone }).format(new Date(0));

  const formatValue = (
    value: CgChartNumericValue,
    options?: Readonly<Intl.NumberFormatOptions>,
  ): string => {
    const formatter = numberFormatter(locale, options ?? defaultValueOptions(value));
    return formatter.format(typeof value === 'string' ? value : value);
  };

  const formatter: ChartFormatter = {
    locale,
    displayTimeZone,
    strings,
    formatArgument(argument, axis) {
      if (axis?.labelFormatter) return axis.labelFormatter(argument.original);
      if (argument.kind === 'category') return argument.categoryText ?? String(argument.original);
      if (argument.kind === 'numeric') {
        const exact = argument.exact!;
        return numberFormatter(locale, axis?.numberFormatOptions ?? {
          maximumFractionDigits: Math.max(0, Math.min(12, exact.scale)),
        }).format(exactText(exact));
      }

      const parts = temporalParts(argument);
      const hasTime = parts.hour !== 0 || parts.minute !== 0 || parts.second !== 0 || parts.millisecond !== 0;
      const defaults: Intl.DateTimeFormatOptions = hasTime || argument.temporalKind !== 'civilDate'
        ? { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: '2-digit' };
      const timeZone = argument.temporalKind === 'instant' ? displayTimeZone : 'UTC';
      const date = argument.temporalKind === 'instant' ? instantDate(argument) : dateAtUtc(parts);
      return new Intl.DateTimeFormat(locale, {
        ...(axis?.dateTimeFormatOptions ?? defaults),
        timeZone,
      }).format(date);
    },
    formatDateTick(epochMilliseconds, kind, axis) {
      const milliseconds = Number(epochMilliseconds);
      if (!Number.isFinite(milliseconds)) throw new RangeError('CgChart date tick is outside the JavaScript Intl range.');
      const iso = new Date(milliseconds).toISOString();
      if (axis?.labelFormatter) {
        const value = kind === 'civilDate' ? iso.slice(0, 10)
          : kind === 'localDateTime' ? iso.slice(0, 23)
            : iso;
        return axis.labelFormatter(value);
      }
      const timeZone = kind === 'instant' ? displayTimeZone : 'UTC';
      const defaults: Intl.DateTimeFormatOptions = kind === 'civilDate'
        ? { year: 'numeric', month: 'short', day: '2-digit' }
        : { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' };
      return new Intl.DateTimeFormat(locale, {
        ...(axis?.dateTimeFormatOptions ?? defaults),
        timeZone,
      }).format(new Date(milliseconds));
    },
    formatValue,
    formatAxisValue(value, axis, interval) {
      if (value.coefficient === 0n) return '0';
      if (axis?.labelFormatter) return axis.labelFormatter(exactText(value) as CgChartNumericValue);
      if (axis?.numberFormatOptions) return numberFormatter(locale, axis.numberFormatOptions).format(exactText(value));

      const absolute = value.coefficient < 0n
        ? { coefficient: -value.coefficient, scale: value.scale }
        : value;
      const billion = { coefficient: 1_000_000_000n, scale: 0 };
      const million = { coefficient: 1_000_000n, scale: 0 };
      const thousand = { coefficient: 10_000n, scale: 0 };
      const intervalMagnitude = interval && interval.coefficient < 0n
        ? { coefficient: -interval.coefficient, scale: interval.scale }
        : interval;
      const distinguishesAt = (power: number) => !intervalMagnitude || exactCompare(
        intervalMagnitude,
        { coefficient: 1n, scale: 1 - power },
      ) >= 0;
      let display = exactText(value);
      let suffix = '';
      if (exactCompare(absolute, billion) >= 0 && distinguishesAt(9)) {
        display = dividePower(value, 9);
        suffix = strings.billionSuffix;
      } else if (exactCompare(absolute, million) >= 0 && distinguishesAt(6)) {
        display = dividePower(value, 6);
        suffix = strings.millionSuffix;
      } else if (exactCompare(absolute, thousand) > 0 && distinguishesAt(3)) {
        display = dividePower(value, 3);
        suffix = strings.thousandSuffix;
      }
      const maximumFractionDigits = suffix ? 1 : interval ? decimalPlaces(interval) : decimalPlaces(value);
      return `${numberFormatter(locale, { maximumFractionDigits }).format(display)}${suffix}`;
    },
    formatPercentage(ratio) {
      return numberFormatter(locale, { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
    },
    formatTooltipValue(value, point, options) {
      if (options?.valueFormatter) return options.valueFormatter(value, point);
      return formatValue(value, options?.numberFormatOptions);
    },
    formatPointLabel(value, point, options) {
      if (options?.formatter) return options.formatter(value, point);
      return formatValue(value, options?.numberFormatOptions);
    },
  };
  return Object.freeze(formatter);
}

export function valueToExactText(value: CgChartNumericValue): string {
  return exactText(exactFromNumeric(value));
}
