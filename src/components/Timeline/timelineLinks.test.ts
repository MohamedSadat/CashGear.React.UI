import { describe, expect, it } from 'vitest';
import { LINK_CLEARANCE, LINK_ENTRY, LINK_EXIT, arrowPath, freePlace, indexLinks, routeLink, routePath } from './timelineLinks';
import type { LinkEnd } from './timelineLinks';

const H = 36;
const none = () => [];
/** Each line's bar, by line: a route must not cross one of these on the lines between its ends. */
const bars = (spans: Record<number, readonly [number, number]>) => (line: number) => (spans[line] ? [spans[line]!] : []);

/** Whether a route's vertical runs cross a bar on a line strictly between its ends' lines. */
function crossesBar(points: ReadonlyArray<readonly [number, number]>, spans: Record<number, readonly [number, number]>) {
  for (let index = 1; index < points.length; index += 1) {
    const [x0, y0] = points[index - 1]!;
    const [x1, y1] = points[index]!;
    for (const [line, [start, end]] of Object.entries(spans)) {
      const top = Number(line) * H + 4;
      const bottom = (Number(line) + 1) * H - 4;
      if (x0 === x1 && x0 > start && x0 < end && Math.max(y0, y1) > top && Math.min(y0, y1) < bottom) return true;
      if (y0 === y1 && y0 > top && y0 < bottom && Math.max(x0, x1) > start && Math.min(x0, x1) < end) return true;
    }
  }
  return false;
}

describe('indexLinks', () => {
  it('keeps the links by each end, leaves a link to itself out and refuses a duplicate or empty id', () => {
    const index = indexLinks([{ id: 'a', from: 'design', to: 'build' }, { id: 'b', from: 'design', to: 'test' }, { id: 'c', from: 'x', to: 'x' }]);
    expect(index.from.get('design')?.map((link) => link.id)).toEqual(['a', 'b']);
    expect(index.to.get('test')?.map((link) => link.id)).toEqual(['b']);
    expect(index.from.has('x')).toBe(false);
    expect(() => indexLinks([{ id: 'a', from: 'p', to: 'q' }, { id: 'a', from: 'q', to: 'r' }])).toThrow(/duplicate link 'a'/u);
    expect(() => indexLinks([{ id: '', from: 'p', to: 'q' }])).toThrow(/nonempty id/u);
  });
});

describe('freePlace', () => {
  it('keeps a free place, else the first free one up to a limit, else the nearer side of the spans it falls in, merged', () => {
    expect(freePlace(50, [[0, 40]])).toBe(50);
    expect(freePlace(10, [[0, 40]])).toBe(0);
    expect(freePlace(30, [[0, 40]])).toBe(40);
    expect(freePlace(30, [[0, 40], [35, 90]])).toBe(0);
    expect(freePlace(10, [[0, 40]], 60)).toBe(40);
    expect(freePlace(10, [[0, 40], [35, 90]], 60)).toBe(0);
  });
});

describe('routeLink', () => {
  const from: LinkEnd = { line: 0, start: 0, end: 100 };

  it('turns once down and once along when the lines between leave room after the blocker', () => {
    const points = routeLink(from, { line: 3, start: 200, end: 260 }, H, 0, 20, bars({ 1: [300, 400], 2: [0, 60] }));
    expect(points).toEqual([[100, 18], [100 + LINK_EXIT, 18], [100 + LINK_EXIT, 3 * H + 18], [200, 3 * H + 18]]);
  });

  it('crosses the lines between where no bar is, along the gaps between lines', () => {
    const spans = { 1: [90, 300], 2: [150, 180] } as const;
    const points = routeLink(from, { line: 3, start: 400, end: 460 }, H, 0, 20, bars(spans));
    expect(crossesBar(points, spans)).toBe(false);
    // Out of the blocker, down to the gap under its line, along it past the bar in the way, down to the blocked bar's line.
    expect(points).toEqual([[100, 18], [106, 18], [106, H], [300 + LINK_CLEARANCE, H], [300 + LINK_CLEARANCE, 3 * H + 18], [400, 3 * H + 18]]);
  });

  it('goes round and back when the blocked bar starts before the blocker ends, a conflict', () => {
    const spans = { 1: [0, 400] } as const;
    const points = routeLink({ line: 0, start: 0, end: 300 }, { line: 2, start: 120, end: 200 }, H, 0, 20, bars(spans));
    expect(crossesBar(points, spans)).toBe(false);
    expect(points.at(-1)).toEqual([120, 2 * H + 18]);
    // The last run comes into the blocked bar's start along its line, toward later days.
    expect(points.at(-2)).toEqual([120 - LINK_ENTRY, 2 * H + 18]);
  });

  it('routes upward to a bar on an earlier line, and between neighbours through their gap', () => {
    const up = routeLink({ line: 5, start: 0, end: 100 }, { line: 2, start: 300, end: 360 }, H, 0, 20, bars({ 3: [100, 200], 4: [80, 120] }));
    expect(crossesBar(up, { 3: [100, 200], 4: [80, 120] })).toBe(false);
    expect(up[0]).toEqual([100, 5 * H + 18]);
    expect(up.at(-1)).toEqual([300, 2 * H + 18]);
    const neighbours = routeLink({ line: 0, start: 0, end: 100 }, { line: 1, start: 50, end: 160 }, H, 0, 20, none);
    expect(neighbours).toEqual([[100, 18], [106, 18], [106, H], [40, H], [40, H + 18], [50, H + 18]]);
  });

  it('looks only at the lines drawn: an end out of them is reached across lines it cannot see', () => {
    const points = routeLink(from, { line: 5000, start: 200, end: 260 }, H, 0, 20, () => [[0, 1000]]);
    // Lines 1 to 20 are in the way, so the route goes round them, on the nearer side; past line 20 it is not drawn.
    expect(points.some(([x]) => x === -LINK_CLEARANCE)).toBe(true);
    expect(points.at(-1)).toEqual([200, 5000 * H + 18]);
  });

  it('keeps two ends on one collapsed lane\'s header line on that line, or goes round under it', () => {
    expect(routeLink({ line: 4, start: 0, end: 50 }, { line: 4, start: 100, end: 120 }, H, 0, 20, none)).toEqual([[50, 4 * H + 18], [100, 4 * H + 18]]);
    expect(routeLink({ line: 4, start: 0, end: 50 }, { line: 4, start: 20, end: 120 }, H, 0, 20, none).at(-1)).toEqual([20, 4 * H + 18]);
  });
});

describe('routePath and arrowPath', () => {
  it('write a route from the first line drawn, and an arrowhead pointing to later days', () => {
    const points = [[100, 2 * H + 18], [106, 2 * H + 18], [106, 4 * H + 18], [200, 4 * H + 18]] as const;
    expect(routePath(points, 2 * H)).toBe('M100 18 L106 18 L106 90 L200 90');
    expect(arrowPath(points, 2 * H)).toBe('M194 86 L200 90 L194 94');
  });
});
