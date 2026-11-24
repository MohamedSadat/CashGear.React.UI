// The timeline's links, pure and tested on its own: the links by the item at each end, and an
// arrow's route from a blocker's bar's end to the start of the bar it blocks, right-angled and
// never through a bar. Each line holds one bar, so a route leaves its first bar along its own line,
// runs along the gaps between lines (no bar reaches them), crosses the lines between only where no
// bar (or the title drawn after a short one) is, and comes into the last bar along that bar's line.
// Coordinates are pixels from the inline start and from the first line's top; mirroring is the
// drawing's.
import type { CgTimelineLink } from './CgTimeline.types';

export interface TimelineLinkIndex {
  /** The links each item blocks others by: by the key in `from`. */
  readonly from: ReadonlyMap<string, ReadonlyArray<CgTimelineLink>>;
  /** The links each item is blocked by: by the key in `to`. */
  readonly to: ReadonlyMap<string, ReadonlyArray<CgTimelineLink>>;
}

/** The links by the item at each end. Ids are unique and nonempty; a link from an item to itself is left out. */
export function indexLinks(links: ReadonlyArray<CgTimelineLink>): TimelineLinkIndex {
  const ids = new Set<string>();
  const from = new Map<string, CgTimelineLink[]>();
  const to = new Map<string, CgTimelineLink[]>();
  for (const link of links) {
    if (typeof link.id !== 'string' || !link.id) throw new Error('CgTimeline links require a nonempty id.');
    if (ids.has(link.id)) throw new Error(`CgTimeline contains duplicate link '${link.id}'.`);
    ids.add(link.id);
    if (typeof link.from !== 'string' || typeof link.to !== 'string' || link.from === link.to) continue;
    const blocks = from.get(link.from);
    if (blocks) blocks.push(link); else from.set(link.from, [link]);
    const blocked = to.get(link.to);
    if (blocked) blocked.push(link); else to.set(link.to, [link]);
  }
  return { from, to };
}

/** A bar as a route sees it: its line, and where it starts and ends along the line, in pixels. */
export interface LinkEnd {
  readonly line: number;
  readonly start: number;
  readonly end: number;
  /** How far a route leaving this bar's end runs before it turns: less when a title is drawn just after the bar. Default `LINK_EXIT`. */
  readonly exit?: number;
}

/** What is drawn on a line that a route must go round: spans of pixels along it. */
export type LineObstacles = (line: number) => ReadonlyArray<readonly [number, number]>;

/** The run along its line out of a blocker's end before a route turns. */
export const LINK_EXIT = 6;
/** The run along its line into a blocked bar's start: the arrowhead's room. */
export const LINK_ENTRY = 10;
/** The room kept beside a bar a route passes. */
export const LINK_CLEARANCE = 4;

type Point = readonly [number, number];

/**
 * A place outside every span: `preferred` when it is free, else the first free one after it up to
 * `within` (when `within` is not before it), else the nearer side of the spans it falls in.
 */
export function freePlace(preferred: number, spans: ReadonlyArray<readonly [number, number]>, within = -Infinity): number {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const inside = merged.find(([start, end]) => preferred > start && preferred < end);
  if (!inside) return preferred;
  if (inside[1] <= within) return inside[1];
  return inside[1] - preferred <= preferred - inside[0] ? inside[1] : inside[0];
}

/** Drops repeated points and the middle of three in a row on one line. */
function simplify(points: ReadonlyArray<Point>): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    const before = result.at(-2);
    if (before && last && ((before[0] === last[0] && last[0] === point[0]) || (before[1] === last[1] && last[1] === point[1]))) result.pop();
    result.push(point);
  }
  return result;
}

/**
 * The route from `from`'s end to `to`'s start, as points: out along `from`'s line, then where the
 * lines between leave room (only `first` to `last` are looked at: the rest are not drawn), into `to`
 * along its line, its last run always toward `to`'s start.
 */
export function routeLink(from: LinkEnd, to: LinkEnd, lineHeight: number, first: number, last: number, obstacles: LineObstacles): Point[] {
  const x1 = from.end;
  const x2 = to.start;
  const y1 = (from.line + 0.5) * lineHeight;
  const y2 = (to.line + 0.5) * lineHeight;
  const out = x1 + (from.exit ?? LINK_EXIT);
  const into = x2 - LINK_ENTRY;
  if (from.line === to.line) {
    // Two ends on one line: only a collapsed lane's header line, which has no bar.
    if (out <= into) return simplify([[x1, y1], [x2, y2]]);
    const gap = (from.line + 1) * lineHeight;
    return simplify([[x1, y1], [out, y1], [out, gap], [into, gap], [into, y2], [x2, y2]]);
  }
  const down = to.line > from.line;
  const leave = down ? (from.line + 1) * lineHeight : from.line * lineHeight;
  const arrive = down ? to.line * lineHeight : (to.line + 1) * lineHeight;
  const spans: (readonly [number, number])[] = [];
  const low = Math.max(first, Math.min(from.line, to.line) + 1);
  const high = Math.min(last, Math.max(from.line, to.line) - 1);
  for (let line = low; line <= high; line += 1) {
    for (const [start, end] of obstacles(line)) spans.push([start - LINK_CLEARANCE, end + LINK_CLEARANCE]);
  }
  const across = freePlace(out, spans, into);
  if (across === out && out <= into) return simplify([[x1, y1], [out, y1], [out, y2], [x2, y2]]);
  if (across >= out && across <= into) return simplify([[x1, y1], [out, y1], [out, leave], [across, leave], [across, y2], [x2, y2]]);
  return simplify([[x1, y1], [out, y1], [out, leave], [across, leave], [across, arrive], [into, arrive], [into, y2], [x2, y2]]);
}

const number = (value: number) => String(Math.round(value * 10) / 10);

/** A route as an SVG path, `top` pixels lifted (the drawing starts at a line other than the first). */
export function routePath(points: ReadonlyArray<Point>, top: number): string {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${number(x)} ${number(y - top)}`).join(' ');
}

/** The arrowhead at a route's end, pointing along the time axis. */
export function arrowPath(points: ReadonlyArray<Point>, top: number): string {
  const [x, y] = points.at(-1)!;
  return `M${number(x - 6)} ${number(y - top - 4)} L${number(x)} ${number(y - top)} L${number(x - 6)} ${number(y - top + 4)}`;
}
