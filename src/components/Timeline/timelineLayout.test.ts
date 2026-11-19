import { describe, expect, it } from 'vitest';
import { dayOfDate } from '../MonthCalendar/monthCalendarDates';
import type { CgTimelineItem } from './CgTimeline.types';
import { axisUnits, shownDays, timelineFormats, unitStart } from './timelineDates';
import {
  TimelinePlacements, buildLines, changeItemDates, drawnLane, keyChange, laneBeside, laneKeyStep, laneMoveDates, laneRange, lineStep, lineUnder, placeItem,
} from './timelineLayout';

const day = (date: string) => dayOfDate(date)!;
const chord = (key: string, mods: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({ key, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...mods });

describe('timeline units', () => {
  it('starts weeks on the first day of the week, months on the 1st, quarters and years on theirs', () => {
    // 2026-11-18 is a Wednesday.
    expect(unitStart('week', day('2026-11-18'), 6)).toBe(day('2026-11-14'));
    expect(unitStart('week', day('2026-11-18'), 0)).toBe(day('2026-11-15'));
    expect(unitStart('month', day('2026-11-18'), 0)).toBe(day('2026-11-01'));
    expect(unitStart('quarter', day('2026-11-18'), 0)).toBe(day('2026-10-01'));
    expect(unitStart('quarter', day('2026-03-31'), 0)).toBe(day('2026-01-01'));
    expect(unitStart('year', day('2026-11-18'), 0)).toBe(day('2026-01-01'));
  });

  it('lists the units touching a range, each with its last day', () => {
    const months = axisUnits('month', day('2026-11-20'), day('2027-01-05'), 0);
    expect(months.map((unit) => [unit.start, unit.end])).toEqual([
      [day('2026-11-01'), day('2026-11-30')],
      [day('2026-12-01'), day('2026-12-31')],
      [day('2027-01-01'), day('2027-01-31')],
    ]);
    const quarters = axisUnits('quarter', day('2026-12-30'), day('2027-04-01'), 0);
    expect(quarters.map((unit) => unit.end - unit.start + 1)).toEqual([92, 90, 91]);
    expect(axisUnits('week', day('2026-11-14'), day('2026-11-27'), 6)).toHaveLength(2);
  });

  it('finds the days a viewport shows, a part of a day counting', () => {
    expect(shownDays(0, 100, 20, 1000)).toEqual({ first: 1000, last: 1004 });
    expect(shownDays(30, 100, 20, 1000)).toEqual({ first: 1001, last: 1006 });
  });

  it('writes quarters by their months unless the caller names them', () => {
    const unit = { kind: 'quarter' as const, start: day('2026-10-01'), end: day('2026-12-31') };
    expect(timelineFormats('en-US').unit(unit, 'lower')).toMatch(/^Oct\s–\sDec$/u);
    expect(timelineFormats('en-US', (quarter, year) => `Q${quarter} ${year}`).unit(unit, 'lower')).toBe('Q4 2026');
    expect(timelineFormats('en-US').unit({ kind: 'month', start: day('2026-11-01'), end: day('2026-11-30') }, 'upper')).toBe('November 2026');
  });
});

const items: CgTimelineItem[] = [
  { key: 'a', title: 'A', start: '2026-11-02', lane: 'x' },
  { key: 'b', title: 'B', start: 'not a date', lane: 'x' },
  { key: 'c', title: 'C', start: '2026-11-04', lane: 'y' },
  { key: 'd', title: 'D', start: '2026-11-05T10:30', lane: 'gone' },
  { key: 'e', title: 'E', start: '2026-11-06T07:30:00Z' },
];

describe('timeline lines', () => {
  it('gives each item with a readable start a line, in the order given', () => {
    const { lines, grouped } = buildLines(items, undefined, new Set(), undefined);
    expect(grouped).toBe(false);
    expect(lines.map((line) => line.id)).toEqual(['i:a', 'i:c', 'i:d', 'i:e']);
  });

  it('groups lines under their lanes, the unlisted ones under a last lane, and hides a collapsed lane\'s items', () => {
    const lanes = [{ key: 'x', title: 'X' }, { key: 'y', title: 'Y' }, { key: 'z', title: 'Z' }];
    const { lines, index } = buildLines(items, lanes, new Set(['y']), 'None');
    expect(lines.map((line) => line.id)).toEqual(['l:x', 'i:a', 'l:y', 'l:z', 'n', 'i:d', 'i:e']);
    expect(lines[2]).toMatchObject({ kind: 'lane', count: 1, collapsed: true });
    expect(lines[4]).toMatchObject({ kind: 'lane', lane: null, title: 'None', count: 2 });
    expect(lines[5]).toMatchObject({ lane: null, laneTitle: 'None' });
    expect(index.get('i:e')).toBe(6);
    expect(() => buildLines(items, lanes, new Set(), undefined)).toThrow(/labels\.noLane/u);
  });

  it('keeps the lanes\' header lines in order, none without lanes', () => {
    const lanes = [{ key: 'x', title: 'X' }, { key: 'y', title: 'Y' }, { key: 'z', title: 'Z' }];
    expect(buildLines(items, lanes, new Set(['y']), 'None').heads).toEqual([0, 2, 3, 4]);
    expect(buildLines(items, undefined, new Set(), undefined).heads).toEqual([]);
  });

  it('refuses duplicate and empty keys', () => {
    expect(() => buildLines([{ key: 'a', title: '', start: '2026-01-01' }, { key: 'a', title: '', start: '2026-01-02' }], undefined, new Set(), undefined)).toThrow(/duplicate key 'a'/u);
    expect(() => buildLines([{ key: '', title: '', start: '2026-01-01' }], undefined, new Set(), undefined)).toThrow(/nonempty key/u);
    expect(() => buildLines([], [{ key: 'x', title: 'X' }, { key: 'x', title: 'X' }], new Set(), undefined)).toThrow(/duplicate lane/u);
  });
});

describe('placing and changing items', () => {
  it('places an item from its start to an inclusive end; a missing or earlier end is one day', () => {
    expect(placeItem({ start: '2026-11-02', end: '2026-11-05' }, undefined)).toEqual({ start: day('2026-11-02'), end: day('2026-11-05') });
    expect(placeItem({ start: '2026-11-02', end: '2026-10-05' }, undefined)).toEqual({ start: day('2026-11-02'), end: day('2026-11-02') });
    expect(placeItem({ start: '2026-11-02', end: 'later' }, undefined)).toEqual({ start: day('2026-11-02'), end: day('2026-11-02') });
    // 22:30 UTC is the next day in Riyadh.
    expect(placeItem({ start: '2026-11-02T22:30:00Z' }, 'Asia/Riyadh')).toEqual({ start: day('2026-11-03'), end: day('2026-11-03') });
    expect(placeItem({ start: 'soon' }, undefined)).toBeNull();
  });

  it('keeps one placement per item object', () => {
    const cache = new TimelinePlacements('Asia/Riyadh');
    const item = { key: 'a', title: 'A', start: '2026-11-02T22:30:00Z' };
    expect(cache.get(item)).toBe(cache.get(item));
    expect(cache.get({ ...item })).not.toBe(cache.get(item));
  });

  it('moves the start and the end by the same days, in their own forms', () => {
    const span = { start: day('2026-11-02'), end: day('2026-11-04') };
    expect(changeItemDates({ start: '2026-11-02', end: '2026-11-04' }, span, 'move', 3, undefined)).toEqual({
      start: '2026-11-05', end: '2026-11-07', days: 3, span: { start: day('2026-11-05'), end: day('2026-11-07') },
    });
    const instant = { start: '2026-11-02T07:30:00Z' };
    const one = placeItem(instant, 'Asia/Riyadh')!;
    expect(changeItemDates(instant, one, 'move', -1, 'Asia/Riyadh')).toMatchObject({ start: '2026-11-01T07:30:00Z', end: null });
    expect(changeItemDates(instant, one, 'move', 0, 'Asia/Riyadh')).toBeNull();
  });

  it('changes a start without passing the end, writing the old start as the end of a one-day item', () => {
    const span = { start: day('2026-11-02'), end: day('2026-11-04') };
    expect(changeItemDates({ start: '2026-11-02', end: '2026-11-04' }, span, 'start', 5, undefined)).toMatchObject({ start: '2026-11-04', end: '2026-11-04', days: 2 });
    const single = { start: '2026-11-02T10:00' };
    const one = placeItem(single, undefined)!;
    expect(changeItemDates(single, one, 'start', -2, undefined)).toMatchObject({ start: '2026-10-31T10:00', end: '2026-11-02T10:00', days: -2 });
    expect(changeItemDates(single, one, 'start', 1, undefined)).toBeNull();
  });

  it('changes an end without passing the start, in the start\'s form when there was no end of its own', () => {
    const single = { start: '2026-11-02T07:30:00Z', end: 'unreadable' };
    const one = placeItem(single, 'Asia/Riyadh')!;
    expect(changeItemDates(single, one, 'end', 2, 'Asia/Riyadh')).toMatchObject({ start: '2026-11-02T07:30:00Z', end: '2026-11-04T07:30:00Z', days: 2 });
    expect(changeItemDates(single, one, 'end', -1, 'Asia/Riyadh')).toBeNull();
    const span = { start: day('2026-11-02'), end: day('2026-11-04') };
    expect(changeItemDates({ start: '2026-11-02', end: '2026-11-04' }, span, 'end', -9, undefined)).toMatchObject({ end: '2026-11-02', days: -2 });
  });
});

describe('moving between lanes', () => {
  const lanes = [{ key: 'x', title: 'X' }, { key: 'y', title: 'Y' }, { key: 'z', title: 'Z' }];
  // Lines: l:x, i:a, l:y (collapsed), l:z (empty), n, i:d, i:e.
  const model = buildLines(items, lanes, new Set(['y']), 'None');

  it('knows the lines each lane takes: a collapsed or empty one its header alone', () => {
    expect(laneRange(model, 'x')).toEqual({ first: 0, last: 1 });
    expect(laneRange(model, 'y')).toEqual({ first: 2, last: 2 });
    expect(laneRange(model, 'z')).toEqual({ first: 3, last: 3 });
    expect(laneRange(model, null)).toEqual({ first: 4, last: 6 });
    expect(laneRange(model, 'gone')).toBeNull();
  });

  it('finds the lane above and below in the order drawn, the last lane of unlisted items last, nothing past either end', () => {
    expect(laneBeside(model, 'x', -1)).toBeUndefined();
    expect(laneBeside(model, 'x', 1)).toBe('y');
    expect(laneBeside(model, 'y', 1)).toBe('z');
    expect(laneBeside(model, 'z', 1)).toBeNull();
    expect(laneBeside(model, null, -1)).toBe('z');
    expect(laneBeside(model, null, 1)).toBeUndefined();
    expect(laneBeside(model, 'gone', 1)).toBeUndefined();
    // Without unlisted items there is no last lane to move to.
    const listed = buildLines(items.filter((item) => item.lane === 'x' || item.lane === 'y'), lanes, new Set(), 'None');
    expect(laneBeside(listed, 'z', 1)).toBeUndefined();
  });

  it('draws an item under its own lane only when that lane is listed', () => {
    expect(drawnLane({ lane: 'x' }, lanes)).toBe('x');
    expect(drawnLane({ lane: 'gone' }, lanes)).toBeNull();
    expect(drawnLane({ lane: null }, lanes)).toBeNull();
    expect(drawnLane({}, lanes)).toBeNull();
    expect(drawnLane({ lane: 'x' }, undefined)).toBeNull();
  });

  it('finds the line under a dragged bar, kept to the lines shown and to the lines there are', () => {
    // Lines shown from viewport y 100 to 400; the first line's top at y 100, then scrolled by 3 lines.
    expect(lineUnder(150, 100, 400, 100, 36, 10)).toBe(1);
    expect(lineUnder(20, 100, 400, 100 - 3 * 36, 36, 20)).toBe(3);
    expect(lineUnder(900, 100, 400, 100 - 3 * 36, 36, 20)).toBe(Math.floor((399 - (100 - 3 * 36)) / 36));
    // Below the last line: the last line.
    expect(lineUnder(380, 100, 400, 100, 36, 4)).toBe(3);
    expect(lineUnder(150, 100, 400, 100, 36, 0)).toBeNull();
  });

  it('keeps the dates of an item moved to another lane by no days, and moves them as a move does', () => {
    const span = { start: day('2026-11-02'), end: day('2026-11-04') };
    expect(laneMoveDates({ start: '2026-11-02', end: '2026-11-04' }, span, 0, undefined)).toEqual({ start: '2026-11-02', end: '2026-11-04', days: 0, span });
    const one = { start: day('2026-11-02'), end: day('2026-11-02') };
    expect(laneMoveDates({ start: '2026-11-02T10:00', end: '' }, one, 0, undefined)).toEqual({ start: '2026-11-02T10:00', end: null, days: 0, span: one });
    expect(laneMoveDates({ start: '2026-11-02', end: '2026-11-04' }, span, -2, undefined)).toEqual({
      start: '2026-10-31', end: '2026-11-02', days: -2, span: { start: day('2026-10-31'), end: day('2026-11-02') },
    });
  });
});

describe('timeline keys', () => {
  it('moves to the lane above with Alt+ArrowUp and below with Alt+ArrowDown, and nothing else', () => {
    expect(laneKeyStep(chord('ArrowUp', { altKey: true }))).toBe(-1);
    expect(laneKeyStep(chord('ArrowDown', { altKey: true }))).toBe(1);
    expect(laneKeyStep(chord('ArrowDown'))).toBeNull();
    expect(laneKeyStep(chord('ArrowDown', { altKey: true, shiftKey: true }))).toBeNull();
    // AltGr (Ctrl with Alt) and Cmd with Alt are left alone.
    expect(laneKeyStep(chord('ArrowDown', { altKey: true, ctrlKey: true }))).toBeNull();
    expect(laneKeyStep(chord('ArrowUp', { altKey: true, metaKey: true }))).toBeNull();
    expect(laneKeyStep(chord('ArrowLeft', { altKey: true }))).toBeNull();
  });

  it('moves along the line, mirrored in right to left, with Alt; the end with Alt+Shift; the start with Ctrl or Cmd and Shift', () => {
    expect(keyChange(chord('ArrowRight', { altKey: true }), false)).toEqual({ edge: 'move', days: 1 });
    expect(keyChange(chord('ArrowRight', { altKey: true }), true)).toEqual({ edge: 'move', days: -1 });
    expect(keyChange(chord('ArrowLeft', { altKey: true }), true)).toEqual({ edge: 'move', days: 1 });
    expect(keyChange(chord('ArrowLeft', { altKey: true, shiftKey: true }), false)).toEqual({ edge: 'end', days: -1 });
    expect(keyChange(chord('ArrowRight', { ctrlKey: true, shiftKey: true }), false)).toEqual({ edge: 'start', days: 1 });
    expect(keyChange(chord('ArrowRight', { metaKey: true, shiftKey: true }), true)).toEqual({ edge: 'start', days: -1 });
  });

  it('leaves AltGr (Ctrl with Alt), plain arrows and other keys alone', () => {
    expect(keyChange(chord('ArrowRight', { altKey: true, ctrlKey: true }), false)).toBeNull();
    expect(keyChange(chord('ArrowRight'), false)).toBeNull();
    expect(keyChange(chord('ArrowRight', { ctrlKey: true }), false)).toBeNull();
    expect(keyChange(chord('ArrowUp', { altKey: true }), false)).toBeNull();
  });

  it('steps between lines, by pages and to either end, inside the list', () => {
    expect(lineStep('ArrowDown', 3, 10, 4)).toBe(4);
    expect(lineStep('ArrowUp', 0, 10, 4)).toBe(0);
    expect(lineStep('PageDown', 8, 10, 4)).toBe(9);
    expect(lineStep('PageUp', 8, 10, 4)).toBe(4);
    expect(lineStep('Home', 8, 10, 4)).toBe(0);
    expect(lineStep('End', 2, 10, 4)).toBe(9);
    expect(lineStep('ArrowLeft', 2, 10, 4)).toBeNull();
  });
});
