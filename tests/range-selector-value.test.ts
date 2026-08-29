import { describe, expect, it } from 'vitest';
import {
  normalizeCgDecimalValue,
  normalizeCgInstantValue,
  normalizeCgLocalDateTimeValue,
} from '../src/components/RangeSelector';
import {
  createRangeModel,
  moveCompleteRange,
  moveRangeHandle,
  rangeRatio,
  rangeValueFromRatio,
} from '../src/components/RangeSelector/rangeValue';
import type { CgDecimalValue, CgInstantValue, CgLocalDateTimeValue } from '../src/components/RangeSelector';

describe('RangeSelector exact value engine', () => {
  it('normalizes exact decimal and temporal construction inputs', () => {
    expect(normalizeCgDecimalValue(' +00012.3400 ')).toBe('12.34');
    expect(normalizeCgDecimalValue('-0.000')).toBe('0');
    expect(normalizeCgLocalDateTimeValue('2026-02-03T04:05')).toBe('2026-02-03T04:05:00.000');
    expect(normalizeCgLocalDateTimeValue('2026-02-03T04:05:06.7')).toBe('2026-02-03T04:05:06.700');
    expect(normalizeCgInstantValue('2026-02-03T04:05Z')).toBe('2026-02-03T04:05:00.000Z');
    expect(normalizeCgInstantValue('2026-02-03T04:05:06.07+05:30')).toBe('2026-02-03T04:05:06.070+05:30');
    expect(() => normalizeCgDecimalValue('1e3')).toThrow(/without an exponent/);
    expect(() => normalizeCgInstantValue('2026-02-03T04:05')).toThrow(/explicit offset/);
  });

  it.each([
    ['bigint', 10n, 1_000_000_000_000_000_000_000n, 20n, 500n, 10n],
    ['date', '2026-01-01', '2026-12-31', '2026-02-01', '2026-04-01', 1],
    ['datetime-local', '2026-01-01T00:00:00.000', '2026-01-03T00:00:00.000', '2026-01-01T06:00:00.000', '2026-01-02T06:00:00.000', 3_600_000],
  ] as const)('round-trips exact %s wires', (kind, minimum, maximum, start, end, step) => {
    const model = createRangeModel({ kind, minimum, maximum, value: { start, end }, step, snapToStep: true });
    expect(model.fromWire(model.start)).toBe(start);
    expect(model.fromWire(model.end)).toBe(end);
    expect(rangeRatio(model, model.start)).toBeGreaterThanOrEqual(0);
    expect(rangeValueFromRatio(model, 0)).toBe(model.minimum);
    expect(rangeValueFromRatio(model, 1)).toBe(model.maximum);
  });

  it('aligns decimal scales and never converts arbitrary precision values to number', () => {
    const minimum = normalizeCgDecimalValue('-100000000000000000000.01');
    const maximum = normalizeCgDecimalValue('100000000000000000000.01');
    const start = normalizeCgDecimalValue('0.001');
    const end = normalizeCgDecimalValue('1.2345');
    const model = createRangeModel({ kind: 'decimal', minimum, maximum, value: { start, end }, step: normalizeCgDecimalValue('0.0001'), snapToStep: true });
    expect(typeof model.start).toBe('bigint');
    expect(model.fromWire(model.start)).toBe(start);
    expect(model.fromWire(model.end)).toBe(end);
  });

  it('compares instants in UTC and retains the minimum offset for generated values', () => {
    const minimum = normalizeCgInstantValue('2026-01-01T00:00+05:30');
    const maximum = normalizeCgInstantValue('2026-01-01T06:30+05:30');
    const start = normalizeCgInstantValue('2025-12-31T20:00Z');
    const end = normalizeCgInstantValue('2026-01-01T00:00Z');
    const model = createRangeModel({ kind: 'instant', minimum, maximum, value: { start, end }, step: 1_800_000, snapToStep: true });
    expect(model.fromWire(model.start)).toBe('2026-01-01T01:30:00.000+05:30');
    expect(model.proposal(model.start, model.end).start).toBe(start);
    const moved = moveCompleteRange(model, { start: model.start, end: model.end }, 1_800_000n, true);
    expect(model.proposal(moved.start, moved.end).start).toBe('2026-01-01T02:00:00.000+05:30');
  });

  it('canonicalizes generated domain boundaries to null while preserving explicit external boundaries', () => {
    const model = createRangeModel({ kind: 'number', minimum: 0, maximum: 100, value: { start: 0, end: 100 }, step: 1, snapToStep: true });
    expect(model.value).toEqual({ start: 0, end: 100 });
    expect(model.proposal(model.minimum, model.maximum)).toEqual({ start: null, end: null });
    expect(Object.isFrozen(model.proposal(model.minimum, model.maximum))).toBe(true);
  });

  it('enforces swapping, exact range clamping, and span bounds', () => {
    const model = createRangeModel({ kind: 'bigint', minimum: 0n, maximum: 100n, value: { start: 20n, end: 40n }, step: 5n, minimumSelectionSpan: 10n, maximumSelectionSpan: 30n, snapToStep: true });
    expect(moveRangeHandle(model, { start: 20n, end: 40n }, 'start', 65n, true, true)).toEqual({ start: 40n, end: 65n, handle: 'end' });
    expect(moveCompleteRange(model, { start: 20n, end: 40n }, -100n, true)).toEqual({ start: 0n, end: 20n });
    expect(moveCompleteRange(model, { start: 20n, end: 40n }, 100n, true)).toEqual({ start: 80n, end: 100n });
  });

  it('rejects invalid domains, values, intervals, spans, and unreachable selections', () => {
    expect(() => createRangeModel({ kind: 'number', minimum: 1, maximum: 1, value: { start: null, end: null }, snapToStep: true })).toThrow(/strictly less/);
    expect(() => createRangeModel({ kind: 'number', minimum: 0, maximum: 10, value: { start: 8, end: 3 }, snapToStep: true })).toThrow(/ordered/);
    expect(() => createRangeModel({ kind: 'date', minimum: '2026-01-01', maximum: '2026-01-10', value: { start: null, end: null }, step: 1.5, snapToStep: true })).toThrow(/positive safe integer/);
    expect(() => createRangeModel({ kind: 'instant', minimum: normalizeCgInstantValue('2026-01-01T00:00Z'), maximum: normalizeCgInstantValue('2026-01-02T00:00Z'), value: { start: null, end: null }, step: 0, snapToStep: true })).toThrow(/positive safe integer/);
    expect(() => createRangeModel({ kind: 'bigint', minimum: 0n, maximum: 10n, value: { start: 0n, end: 4n }, step: 6n, minimumSelectionSpan: 4n, maximumSelectionSpan: 5n, snapToStep: true })).toThrow(/no reachable/);
  });

  it('requires branded external strings to already be normalized', () => {
    expect(() => createRangeModel({ kind: 'decimal', minimum: '0.0' as CgDecimalValue, maximum: '10' as CgDecimalValue, value: { start: null, end: null }, snapToStep: true })).toThrow(/normalized/);
    expect(() => createRangeModel({ kind: 'datetime-local', minimum: '2026-01-01T00:00' as CgLocalDateTimeValue, maximum: '2026-01-02T00:00:00.000' as CgLocalDateTimeValue, value: { start: null, end: null }, snapToStep: true })).toThrow(/normalized/);
    expect(() => createRangeModel({ kind: 'instant', minimum: '2026-01-01T00:00Z' as CgInstantValue, maximum: '2026-01-02T00:00:00.000Z' as CgInstantValue, value: { start: null, end: null }, snapToStep: true })).toThrow(/normalized/);
  });
});
