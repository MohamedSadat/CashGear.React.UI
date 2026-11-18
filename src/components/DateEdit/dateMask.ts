/**
 * The DateEdit typing mask, ported from Blazor's `CgDateEdit.razor.js` (`DateMaskEditor`) and
 * `CgDateMaskLayout.cs`. The engine is pure state: the component feeds it keys and text and writes the
 * text and selection it returns into the input.
 */

export type DateMaskPart = 'day' | 'month' | 'year';
export type DateMaskKind = 'numeric' | 'short' | 'long';
export interface DateMaskToken { readonly literal?: string; readonly part?: DateMaskPart; readonly kind?: DateMaskKind; readonly width?: number }
export interface DateMaskValue { readonly day: number | null; readonly month: number | null; readonly year: number | null }
export type DateMaskCompleteness = 'empty' | 'incomplete' | 'complete';

const PROMPT = '_';
const TYPE_AHEAD_RESET = 1000;
const LETTER = /\p{L}/u;
const TOKEN_GROUPS = /\p{L}+|\d+/gu;
const DIRECTION_MARKS = /[‎‏؜]/gu;

/** Arabic-Indic and Persian digits typed or pasted become ASCII digits. */
export function normalizeMaskDigits(text: string): string {
  return String(text ?? '').replace(/[٠-٩۰-۹]/gu, (character) => {
    const code = character.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function fold(text: string): string { return String(text ?? '').normalize('NFC').toLocaleLowerCase(); }
function isLeapYear(year: number): boolean { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0; }
function daysInMonth(year: number, month: number): number { return month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31; }

/**
 * Mask tokens from a .NET-style date format: numeric parts edit at full width (`d/M/yyyy` edits as
 * `dd/MM/yyyy`), `MMM`/`MMMM` take month names, `yy` two-digit years. A format with a weekday, time or a
 * repeated part cannot be a mask and returns `null`.
 */
export function createDateMaskTokens(format: string): ReadonlyArray<DateMaskToken> | null {
  const tokens: DateMaskToken[] = [];
  const parts = new Set<DateMaskPart>();
  let literal = '';
  const flush = () => { const text = literal.replace(DIRECTION_MARKS, ''); if (text) tokens.push(Object.freeze({ literal: text })); literal = ''; };
  for (let index = 0; index < format.length; index++) {
    const character = format[index]!;
    if (character === '\\') { if (index + 1 < format.length) literal += format[++index]; continue; }
    if (character === "'" || character === '"') {
      for (index++; index < format.length && format[index] !== character; index++) literal += format[index] === '\\' && index + 1 < format.length ? format[++index] : format[index];
      continue;
    }
    if (character === '%') continue;
    if ('hHmsfFtzKg:'.includes(character)) return null;
    if (character !== 'd' && character !== 'M' && character !== 'y') { literal += character; continue; }
    let run = 1;
    while (index + run < format.length && format[index + run] === character) run++;
    index += run - 1;
    if (character === 'd' && run > 2) return null;
    const part: DateMaskPart = character === 'd' ? 'day' : character === 'M' ? 'month' : 'year';
    if (parts.has(part)) return null;
    parts.add(part);
    flush();
    if (part === 'day') tokens.push(Object.freeze({ part, kind: 'numeric', width: 2 }));
    else if (part === 'month') tokens.push(Object.freeze(run <= 2 ? { part, kind: 'numeric' as const, width: 2 } : { part, kind: run === 3 ? 'short' as const : 'long' as const, width: 0 }));
    else tokens.push(Object.freeze({ part, kind: 'numeric', width: run <= 2 ? 2 : 4 }));
  }
  flush();
  return parts.size ? Object.freeze(tokens) : null;
}

interface Section { part: DateMaskPart; kind: DateMaskKind; width: number; value: number | null; typed: string }

export interface DateMaskOptions {
  readonly tokens: ReadonlyArray<DateMaskToken>;
  readonly monthNames: ReadonlyArray<string>;
  readonly shortMonthNames: ReadonlyArray<string>;
  readonly twoDigitYearMax?: number;
  readonly today: DateMaskValue;
}

/** Typing state of one focused DateEdit. */
export class DateMaskEditor {
  readonly tokens: ReadonlyArray<DateMaskToken>;
  readonly numericOnly: boolean;
  private readonly monthNames: ReadonlyArray<string>;
  private readonly shortMonthNames: ReadonlyArray<string>;
  private readonly twoDigitYearMax: number;
  private readonly today: DateMaskValue;
  private sections: Section[] = [];
  private entries: Array<{ start: number; end: number }> = [];
  active = 0;
  private advanced = false;
  private buffer = '';
  private bufferTime = 0;
  private baseline: DateMaskValue | null = null;

  constructor(options: DateMaskOptions, value: DateMaskValue | null) {
    this.tokens = options.tokens;
    this.monthNames = options.monthNames;
    this.shortMonthNames = options.shortMonthNames;
    this.twoDigitYearMax = options.twoDigitYearMax ?? 2049;
    this.today = options.today;
    // Digits and separators lay out left to right even in an RTL field; only month names make the mask RTL.
    this.numericOnly = this.tokens.every((token) => token.part ? token.kind === 'numeric' : !LETTER.test(token.literal ?? ''));
    this.load(value);
  }

  get hasMonthNames(): boolean { return this.sections.some((section) => section.kind !== 'numeric'); }

  load(value: DateMaskValue | null): void {
    this.baseline = value;
    this.sections = this.tokens.filter((token) => token.part).map((token) => ({ part: token.part!, kind: token.kind ?? 'numeric', width: token.width ?? 2, value: value?.[token.part!] ?? null, typed: '' }));
    this.advanced = false;
    this.buffer = '';
    this.active = Math.min(this.active, Math.max(0, this.sections.length - 1));
    this.compose();
  }

  private section(part: DateMaskPart): Section | undefined { return this.sections.find((section) => section.part === part); }

  snapshot(): DateMaskValue {
    const result: { day: number | null; month: number | null; year: number | null } = { day: null, month: null, year: null };
    for (const section of this.sections) result[section.part] = section.value;
    return result;
  }

  completeness(): DateMaskCompleteness {
    const filled = this.sections.filter((section) => section.value != null).length;
    return filled === 0 ? 'empty' : filled === this.sections.length ? 'complete' : 'incomplete';
  }

  isDirty(): boolean { return this.sections.some((section) => (section.value ?? null) !== (this.baseline?.[section.part] ?? null)); }

  private expandYear(twoDigits: number): number {
    const year = Math.floor(this.twoDigitYearMax / 100) * 100 + twoDigits;
    return year > this.twoDigitYearMax ? year - 100 : year;
  }

  private dayLimit(): number {
    const month = this.section('month');
    const year = this.section('year');
    return month?.value != null ? daysInMonth(year?.value ?? 2000, month.value) : 31;
  }

  // An impossible day is corrected rather than refused: 31 then February gives 28 or 29.
  private clampDay(): void {
    const day = this.section('day');
    if (!day || day.value == null || day.typed) return;
    day.value = Math.min(day.value, this.dayLimit());
  }

  private finalizeSection(section: Section | undefined): void {
    if (!section?.typed) return;
    const digits = section.typed;
    section.typed = '';
    if (section.part === 'year') {
      const year = digits.length <= 2 ? this.expandYear(Number(digits)) : digits.length === 3 ? null : Number(digits);
      section.value = year != null && year >= 1 ? year : null;
    } else {
      const value = Number(digits);
      section.value = value >= 1 ? value : null;
    }
    this.clampDay();
  }

  finalizeAll(): void { for (const section of this.sections) this.finalizeSection(section); }

  private sectionText(section: Section): string {
    if (section.typed) {
      const width = section.kind === 'numeric' ? section.width : 2;
      return section.typed + PROMPT.repeat(Math.max(0, width - section.typed.length));
    }
    if (section.value == null) return PROMPT.repeat(section.kind === 'numeric' ? section.width : 3);
    if (section.kind === 'long') return this.monthNames[section.value - 1] ?? '';
    if (section.kind === 'short') return this.shortMonthNames[section.value - 1] ?? '';
    const value = section.part === 'year' && section.width === 2 ? section.value % 100 : section.value;
    return String(value).padStart(section.width, '0');
  }

  /** The mask text, recording where each part sits. */
  compose(): string {
    let text = '';
    let index = 0;
    const entries: Array<{ start: number; end: number }> = [];
    for (const token of this.tokens) {
      if (!token.part) { text += token.literal ?? ''; continue; }
      const start = text.length;
      text += this.sectionText(this.sections[index++]!);
      entries.push({ start, end: text.length });
    }
    this.entries = entries;
    return text;
  }

  /** Selection of the highlighted part. */
  activeRange(): { readonly start: number; readonly end: number } {
    this.compose();
    return this.entries[this.active] ?? { start: 0, end: 0 };
  }

  private sectionAt(position: number): number {
    let index = 0;
    this.entries.forEach((entry, candidate) => { if (position >= entry.start) index = candidate; });
    return index;
  }

  private covered(selectionStart: number, selectionEnd: number): number[] {
    if (selectionStart === selectionEnd) return [];
    return this.entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.start < selectionEnd && entry.end > selectionStart).map(({ index }) => index);
  }

  /** Click or caret move: highlight the part under the caret, unless a drag spans several parts. */
  selectAt(selectionStart: number, selectionEnd: number): boolean {
    this.compose();
    if (selectionEnd - selectionStart > 0 && this.covered(selectionStart, selectionEnd).length > 1) return false;
    const index = this.sectionAt(selectionStart);
    if (index !== this.active) this.finalizeSection(this.sections[this.active]);
    this.active = index;
    this.advanced = false;
    this.buffer = '';
    return true;
  }

  private clearSection(section: Section | undefined): void { if (section) { section.value = null; section.typed = ''; } }

  /** A selection across several parts (select-all, a drag) is cleared as a unit. */
  private clearCovered(selectionStart: number, selectionEnd: number): boolean {
    this.compose();
    const covered = this.covered(selectionStart, selectionEnd);
    if (covered.length <= 1) return false;
    for (const index of covered) this.clearSection(this.sections[index]);
    this.active = covered[0]!;
    this.advanced = false;
    this.buffer = '';
    return true;
  }

  activate(index: number): void {
    if (!this.sections.length) return;
    this.finalizeSection(this.sections[this.active]);
    this.active = Math.min(this.sections.length - 1, Math.max(0, index));
    this.advanced = false;
    this.buffer = '';
  }

  move(step: number): void { this.activate(this.active + step); }
  first(): void { this.activate(0); }
  last(): void { this.activate(this.sections.length - 1); }

  insertText(text: string, selectionStart = 0, selectionEnd = 0, now = Date.now()): void {
    this.clearCovered(selectionStart, selectionEnd);
    for (const character of normalizeMaskDigits(text)) this.insertCharacter(character, now);
  }

  private insertCharacter(character: string, now: number): void {
    const section = this.sections[this.active];
    if (!section) return;
    const advanced = this.advanced;
    this.advanced = false;
    if (character >= '0' && character <= '9') { this.buffer = ''; this.typeDigit(section, Number(character)); }
    else if (LETTER.test(character)) { if (section.part === 'month' && section.kind !== 'numeric') this.typeLetter(section, character, now); }
    else if (section.typed) { this.finalizeSection(section); this.next(); }
    else if (!advanced) this.next();
  }

  private next(): void { if (this.active < this.sections.length - 1) this.active++; }

  private complete(section: Section, value: number): void {
    section.value = value;
    section.typed = '';
    this.clampDay();
    if (this.active < this.sections.length - 1) { this.active++; this.advanced = true; }
  }

  private typeDigit(section: Section, digit: number): void {
    if (section.part === 'year') { this.typeYearDigit(section, digit); return; }
    const max = section.part === 'day' ? 31 : 12;
    if (!section.typed) {
      section.value = null;
      if (digit === 0) { section.typed = '0'; return; }
      if (digit * 10 > max) { this.complete(section, digit); return; }
      section.typed = String(digit);
      return;
    }
    const combined = Number(section.typed + digit);
    if (combined === 0) return;
    if (combined > max) { section.typed = ''; this.typeDigit(section, digit); return; }
    this.complete(section, combined);
  }

  private typeYearDigit(section: Section, digit: number): void {
    if (!section.typed) section.value = null;
    section.typed += String(digit);
    if (section.typed.length < section.width) return;
    const typed = Number(section.typed);
    const year = section.width === 2 ? this.expandYear(typed) : typed;
    if (year < 1) { section.typed = ''; return; }
    this.complete(section, year);
  }

  private matchMonths(prefix: string): number[] {
    const matches: number[] = [];
    for (let month = 1; month <= 12; month++) {
      const names = [this.monthNames[month - 1], this.shortMonthNames[month - 1]];
      if (names.some((name) => name && fold(name).startsWith(prefix))) matches.push(month);
    }
    return matches;
  }

  private typeLetter(section: Section, character: string, now: number): void {
    if (now - this.bufferTime > TYPE_AHEAD_RESET) this.buffer = '';
    this.bufferTime = now;
    let prefix = fold(this.buffer + character);
    let matches = this.matchMonths(prefix);
    if (!matches.length) { prefix = fold(character); matches = this.matchMonths(prefix); }
    if (!matches.length) { this.buffer = ''; return; }
    section.typed = '';
    if (matches.length === 1) { this.buffer = ''; this.complete(section, matches[0]!); return; }
    this.buffer = prefix;
    section.value = matches[0]!;
    this.clampDay();
  }

  /** Up/Down: an empty part starts from today; day and month wrap; the year stops at 1 and 9999. */
  spin(delta: number): void {
    const section = this.sections[this.active];
    if (!section) return;
    this.finalizeSection(section);
    this.buffer = '';
    this.advanced = false;
    if (section.value == null) section.value = this.today[section.part];
    else if (section.part === 'day') { const limit = this.dayLimit(); section.value = ((section.value - 1 + delta) % limit + limit) % limit + 1; }
    else if (section.part === 'month') section.value = ((section.value - 1 + delta) % 12 + 12) % 12 + 1;
    else section.value = Math.min(9999, Math.max(1, section.value + delta));
    this.clampDay();
  }

  /** Backspace removes the last typed digit, then clears the part, then steps back. */
  deleteBackward(selectionStart = 0, selectionEnd = 0): void {
    if (this.clearCovered(selectionStart, selectionEnd)) return;
    const section = this.sections[this.active];
    this.buffer = '';
    this.advanced = false;
    if (!section) return;
    if (section.typed) section.typed = section.typed.slice(0, -1);
    else if (section.value != null) section.value = null;
    else if (this.active > 0) this.active--;
  }

  /** Delete clears the part. */
  deleteForward(selectionStart = 0, selectionEnd = 0): void {
    if (this.clearCovered(selectionStart, selectionEnd)) return;
    this.clearSection(this.sections[this.active]);
    this.buffer = '';
    this.advanced = false;
  }

  /** Pasting `1.8.26`, `15082026`, `2026-08-15` or `15 Aug 2026` fills every part at once. */
  paste(text: string, selectionStart = 0, selectionEnd = 0): void {
    this.compose();
    const groups = normalizeMaskDigits(text).trim().match(TOKEN_GROUPS) ?? [];
    if (!groups.length) return;
    const current = this.sections[this.active];
    const single = groups[0] ?? '';
    if (groups.length === 1 && /^\d+$/u.test(single) && current?.kind === 'numeric' && single.length <= current.width && this.covered(selectionStart, selectionEnd).length <= 1) {
      this.insertText(single, selectionStart, selectionEnd);
      return;
    }
    const values = this.parsePaste(groups);
    if (!values) return;
    for (const section of this.sections) { section.value = values[section.part] ?? null; section.typed = ''; }
    this.clampDay();
    this.advanced = false;
    this.buffer = '';
    this.active = this.sections.length - 1;
  }

  private parsePaste(groups: ReadonlyArray<string>): Partial<Record<DateMaskPart, number>> | null {
    let candidates: ReadonlyArray<string> = groups;
    if (groups.length === 1 && /^\d+$/u.test(groups[0]!)) {
      const digits = groups[0]!;
      const widths = this.sections.map((section) => section.kind === 'numeric' ? section.width : 2);
      const total = widths.reduce((sum, width) => sum + width, 0);
      const yearIndex = this.sections.findIndex((section) => section.part === 'year');
      if (digits.length === total - 2 && yearIndex >= 0 && widths[yearIndex] === 4) widths[yearIndex] = 2;
      else if (digits.length !== total) return null;
      let offset = 0;
      candidates = widths.map((width) => { const group = digits.slice(offset, offset + width); offset += width; return group; });
    }
    if (candidates.length !== this.sections.length) return null;
    return this.assignGroups(candidates, this.sections.map((section) => section.part))
      ?? (candidates.length === 3 && candidates[0]!.length === 4 ? this.assignGroups(candidates, ['year', 'month', 'day']) : null);
  }

  private assignGroups(groups: ReadonlyArray<string>, parts: ReadonlyArray<DateMaskPart>): Partial<Record<DateMaskPart, number>> | null {
    const values: Partial<Record<DateMaskPart, number>> = {};
    for (let index = 0; index < parts.length; index++) {
      const value = this.parseGroup(parts[index]!, groups[index]!);
      if (value == null) return null;
      values[parts[index]!] = value;
    }
    return this.sections.every((section) => values[section.part] != null) ? values : null;
  }

  private parseGroup(part: DateMaskPart, group: string): number | null {
    if (/^\d+$/u.test(group)) {
      const value = Number(group);
      if (part === 'year') { const year = group.length <= 2 ? this.expandYear(value) : value; return year >= 1 && year <= 9999 ? year : null; }
      return value >= 1 && value <= (part === 'day' ? 31 : 12) ? value : null;
    }
    return part === 'month' ? this.matchMonths(fold(group))[0] ?? null : null;
  }

  /**
   * Enter: an unfinished date highlights the first missing part and reports nothing; an empty date is
   * kept only when the editor can be empty.
   */
  commit(nullable: boolean, committed: DateMaskValue | null): 'commit' | 'incomplete' | 'restored' {
    this.buffer = '';
    this.finalizeAll();
    const state = this.completeness();
    if (state === 'incomplete') { this.active = Math.max(0, this.sections.findIndex((section) => section.value == null)); return 'incomplete'; }
    if (state === 'empty' && !nullable) { this.load(committed); return 'restored'; }
    return 'commit';
  }

  /** Blur: an unfinished date is abandoned, not reported as an error. */
  blur(nullable: boolean, committed: DateMaskValue | null): void {
    this.buffer = '';
    this.finalizeAll();
    const state = this.completeness();
    if (state === 'incomplete' || (state === 'empty' && !nullable)) this.load(committed);
  }
}
