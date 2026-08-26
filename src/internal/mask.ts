export type MaskTokenKind = 'literal' | 'digit' | 'letter' | 'alphanumeric' | 'printable';

export interface MaskToken {
  kind: MaskTokenKind;
  text: string;
  editableIndex: number;
  required: boolean;
}

export interface CompiledMask {
  source: string;
  tokens: ReadonlyArray<MaskToken>;
  editableTokens: ReadonlyArray<MaskToken>;
  editableCount: number;
}

export type MaskIssueKind = 'rejected' | 'extra' | 'misplaced';
export interface MaskIssue { kind: MaskIssueKind; character: string; inputIndex: number; }

export interface MaskState {
  slots: ReadonlyArray<string | null>;
  issues: ReadonlyArray<MaskIssue>;
  invalidExternal: boolean;
}

export interface MaskDisplayEntry {
  tokenIndex: number;
  token: MaskToken;
  start: number;
  end: number;
}

export interface MaskDisplay {
  text: string;
  entries: ReadonlyArray<MaskDisplayEntry>;
}

const DIGIT = /^\p{Nd}$/u;
const LETTER = /^\p{L}$/u;
const ALPHANUMERIC = /^[\p{L}\p{Nd}]$/u;
const NON_PRINTABLE = /^[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}\p{Cn}]$/u;

export function compileMask(mask: string): CompiledMask {
  if (!mask) throw new Error('CgMaskedInput requires a nonempty mask.');
  const tokens: MaskToken[] = [];
  const editableTokens: MaskToken[] = [];
  let escaped = false;
  for (const character of Array.from(mask)) {
    if (escaped) {
      tokens.push({ kind: 'literal', text: character, editableIndex: -1, required: false });
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    const descriptor = {
      '0': ['digit', true],
      '9': ['digit', false],
      L: ['letter', true],
      l: ['letter', false],
      A: ['alphanumeric', true],
      a: ['alphanumeric', false],
      '*': ['printable', true],
      '?': ['printable', false],
    }[character] as readonly [Exclude<MaskTokenKind, 'literal'>, boolean] | undefined;
    if (!descriptor) {
      tokens.push({ kind: 'literal', text: character, editableIndex: -1, required: false });
      continue;
    }
    const token: MaskToken = {
      kind: descriptor[0],
      text: '',
      editableIndex: editableTokens.length,
      required: descriptor[1],
    };
    tokens.push(token);
    editableTokens.push(token);
  }
  if (escaped) throw new Error('CgMaskedInput mask cannot end with an escape character.');
  return { source: mask, tokens, editableTokens, editableCount: editableTokens.length };
}

export function validatePromptCharacter(promptCharacter: string): string {
  const normalized = promptCharacter.normalize('NFC');
  const characters = Array.from(normalized);
  if (characters.length !== 1 || NON_PRINTABLE.test(characters[0] ?? '')) {
    throw new Error('CgMaskedInput promptCharacter must be one visible Unicode character.');
  }
  return characters[0] ?? '_';
}

export function maskAccepts(token: MaskToken, value: string, promptCharacter: string): boolean {
  if (token.kind === 'literal') return false;
  const normalized = value.normalize('NFC');
  const characters = Array.from(normalized);
  if (characters.length !== 1 || characters[0] === promptCharacter) return false;
  const character = characters[0] ?? '';
  if (token.kind === 'digit') return DIGIT.test(character);
  if (token.kind === 'letter') return LETTER.test(character);
  if (token.kind === 'alphanumeric') return ALPHANUMERIC.test(character);
  return !NON_PRINTABLE.test(character);
}

export function emptyMaskState(definition: CompiledMask): MaskState {
  return { slots: Array<string | null>(definition.editableCount).fill(null), issues: [], invalidExternal: false };
}

export function maskStateFromSlots(
  definition: CompiledMask,
  promptCharacter: string,
  slots: ReadonlyArray<string | null>,
  issues: ReadonlyArray<MaskIssue> = [],
): MaskState {
  if (slots.length !== definition.editableCount) throw new Error('CgMaskedInput received an incompatible mask slot snapshot.');
  const normalized = slots.map((value, index) => {
    if (!value) return null;
    const character = value.normalize('NFC');
    const token = definition.editableTokens[index];
    if (!token || !maskAccepts(token, character, promptCharacter)) {
      throw new Error(`CgMaskedInput mask slot ${index} contains an incompatible character.`);
    }
    return character;
  });
  return { slots: normalized, issues: [...issues], invalidExternal: issues.length > 0 };
}

function nextLiteralIndex(definition: CompiledMask, tokenIndex: number, character: string): number {
  for (let index = tokenIndex; index < definition.tokens.length; index += 1) {
    const token = definition.tokens[index];
    if (token?.kind === 'literal' && token.text === character) return index;
  }
  return -1;
}

function nextAcceptingIndex(definition: CompiledMask, tokenIndex: number, character: string, promptCharacter: string): number {
  for (let index = tokenIndex; index < definition.tokens.length; index += 1) {
    const token = definition.tokens[index];
    if (token?.kind !== 'literal' && token && maskAccepts(token, character, promptCharacter)) return index;
  }
  return -1;
}

export function normalizeMaskValue(definition: CompiledMask, promptCharacter: string, value: string | undefined): MaskState {
  const prompt = validatePromptCharacter(promptCharacter);
  if (!value) return emptyMaskState(definition);
  const slots = Array<string | null>(definition.editableCount).fill(null);
  const issues: MaskIssue[] = [];
  let tokenIndex = 0;
  const input = Array.from(value.normalize('NFC'));
  input.forEach((character, inputIndex) => {
    if (character === prompt) {
      while (tokenIndex < definition.tokens.length && definition.tokens[tokenIndex]?.kind === 'literal') tokenIndex += 1;
      if (tokenIndex < definition.tokens.length) tokenIndex += 1;
      return;
    }
    while (tokenIndex < definition.tokens.length && definition.tokens[tokenIndex]?.kind === 'literal') {
      if (definition.tokens[tokenIndex]?.text === character) {
        tokenIndex += 1;
        return;
      }
      tokenIndex += 1;
    }
    const token = definition.tokens[tokenIndex];
    if (token && token.kind !== 'literal' && maskAccepts(token, character, prompt)) {
      slots[token.editableIndex] = character;
      tokenIndex += 1;
      return;
    }
    const literalIndex = nextLiteralIndex(definition, tokenIndex + 1, character);
    if (literalIndex >= 0) {
      tokenIndex = literalIndex + 1;
      return;
    }
    const acceptingIndex = nextAcceptingIndex(definition, tokenIndex + 1, character, prompt);
    if (acceptingIndex >= 0) {
      const accepting = definition.tokens[acceptingIndex];
      if (accepting && accepting.kind !== 'literal') slots[accepting.editableIndex] = character;
      issues.push({ kind: 'misplaced', character, inputIndex });
      tokenIndex = acceptingIndex + 1;
      return;
    }
    issues.push({ kind: tokenIndex >= definition.tokens.length ? 'extra' : 'rejected', character, inputIndex });
  });
  return { slots, issues, invalidExternal: issues.length > 0 };
}

export function maskRawValue(state: MaskState): string {
  return state.slots.filter((value): value is string => value !== null).join('');
}

export function maskIsEmpty(state: MaskState): boolean {
  return state.slots.every((value) => value === null);
}

export function maskIsComplete(definition: CompiledMask, state: MaskState): boolean {
  return definition.editableTokens.every((token) => !token.required || state.slots[token.editableIndex] !== null);
}

export function maskFormattedValue(definition: CompiledMask, state: MaskState, spacesForHoles = false): string {
  let lastFilledTokenIndex = -1;
  definition.tokens.forEach((token, index) => {
    if (token.kind !== 'literal' && state.slots[token.editableIndex] !== null) lastFilledTokenIndex = index;
  });
  if (lastFilledTokenIndex < 0) return '';
  let endIndex = lastFilledTokenIndex;
  while (definition.tokens[endIndex + 1]?.kind === 'literal') endIndex += 1;
  let result = '';
  for (let index = 0; index <= endIndex; index += 1) {
    const token = definition.tokens[index];
    if (!token) continue;
    if (token.kind === 'literal') result += token.text;
    else result += state.slots[token.editableIndex] ?? (spacesForHoles ? ' ' : '');
  }
  return result;
}

export function maskBoundValue(definition: CompiledMask, state: MaskState, includeLiterals: boolean): string {
  return includeLiterals ? maskFormattedValue(definition, state) : maskRawValue(state);
}

export function maskIsValid(definition: CompiledMask, state: MaskState, required: boolean, allowIncomplete: boolean): boolean {
  if (state.invalidExternal) return false;
  if (maskIsEmpty(state)) return !required;
  return allowIncomplete || maskIsComplete(definition, state);
}

export function displayMaskState(
  definition: CompiledMask,
  state: MaskState,
  promptCharacter: string,
  showMask: 'always' | 'onFocus' | 'never',
  focused: boolean,
): MaskDisplay {
  const full = showMask === 'always' || showMask === 'onFocus' && focused;
  let lastTokenIndex = definition.tokens.length - 1;
  if (!full) {
    lastTokenIndex = -1;
    definition.tokens.forEach((token, index) => {
      if (token.kind !== 'literal' && state.slots[token.editableIndex] !== null) lastTokenIndex = index;
    });
    while (lastTokenIndex >= 0 && definition.tokens[lastTokenIndex + 1]?.kind === 'literal') lastTokenIndex += 1;
  }
  let text = '';
  const entries: MaskDisplayEntry[] = [];
  if (lastTokenIndex < 0) return { text, entries };
  for (let tokenIndex = 0; tokenIndex <= lastTokenIndex; tokenIndex += 1) {
    const token = definition.tokens[tokenIndex];
    if (!token) continue;
    const start = text.length;
    text += token.kind === 'literal'
      ? token.text
      : state.slots[token.editableIndex] ?? (full ? promptCharacter : ' ');
    entries.push({ tokenIndex, token, start, end: text.length });
  }
  return { text, entries };
}

function nextEditableToken(definition: CompiledMask, tokenIndex: number): MaskToken | undefined {
  for (let index = Math.max(0, tokenIndex); index < definition.tokens.length; index += 1) {
    const token = definition.tokens[index];
    if (token?.kind !== 'literal') return token;
  }
  return undefined;
}

export function maskEndSlot(state: MaskState): number {
  const empty = state.slots.findIndex((value) => value === null);
  return empty < 0 ? state.slots.length : empty;
}

export function maskTargetSlot(display: MaskDisplay, definition: CompiledMask, state: MaskState, position: number): number {
  for (const entry of display.entries) {
    if (entry.token.kind !== 'literal' && (position <= entry.start || position < entry.end)) return entry.token.editableIndex;
    if (entry.token.kind === 'literal' && position < entry.end) {
      return nextEditableToken(definition, entry.tokenIndex + 1)?.editableIndex ?? maskEndSlot(state);
    }
  }
  return maskEndSlot(state);
}

export function maskCaretPosition(display: MaskDisplay, state: MaskState, slotIndex: number): number {
  if (slotIndex >= state.slots.length) return display.text.length;
  return display.entries.find((entry) => entry.token.kind !== 'literal' && entry.token.editableIndex === slotIndex)?.start ?? display.text.length;
}

export function maskSelectedSlots(display: MaskDisplay, start: number, end: number): number[] {
  if (start === end) return [];
  return display.entries
    .filter((entry) => entry.token.kind !== 'literal' && entry.end > start && entry.start < end)
    .map((entry) => entry.token.editableIndex);
}

export function maskTokenIndexAtPosition(display: MaskDisplay, definition: CompiledMask, state: MaskState, position: number): number {
  for (const entry of display.entries) {
    if (position < entry.end || position === entry.start) return entry.tokenIndex;
  }
  return maskTokenIndexForSlot(definition, maskEndSlot(state));
}

export interface MaskEditResult { state: MaskState; accepted: number; nextSlot: number; }

export function applyMaskText(
  definition: CompiledMask,
  state: MaskState,
  promptCharacter: string,
  text: string,
  startTokenIndex: number,
  clearedSlots: ReadonlyArray<number> = [],
): MaskEditResult {
  const slots = [...state.slots];
  clearedSlots.forEach((index) => { if (index >= 0 && index < slots.length) slots[index] = null; });
  let tokenIndex = Math.max(0, startTokenIndex);
  let accepted = 0;
  for (const character of Array.from(text.normalize('NFC'))) {
    while (tokenIndex < definition.tokens.length) {
      const token = definition.tokens[tokenIndex];
      tokenIndex += 1;
      if (!token) break;
      if (token.kind === 'literal') {
        if (token.text === character) break;
        continue;
      }
      if (character === promptCharacter) break;
      if (maskAccepts(token, character, promptCharacter)) {
        slots[token.editableIndex] = character;
        accepted += 1;
        break;
      }
    }
    if (tokenIndex >= definition.tokens.length) break;
  }
  const next = nextEditableToken(definition, tokenIndex);
  return {
    state: { slots, issues: [], invalidExternal: false },
    accepted,
    nextSlot: next?.editableIndex ?? slots.length,
  };
}

export function maskTokenIndexForSlot(definition: CompiledMask, slotIndex: number): number {
  if (slotIndex >= definition.editableCount) return definition.tokens.length;
  return definition.tokens.findIndex((token) => token.kind !== 'literal' && token.editableIndex === slotIndex);
}

export function sameMaskSlots(left: MaskState, right: MaskState): boolean {
  return left.invalidExternal === right.invalidExternal
    && left.slots.length === right.slots.length
    && left.slots.every((value, index) => value === right.slots[index]);
}

export function maskStateSignature(state: MaskState): string {
  return `${state.invalidExternal ? '!' : '='}${state.slots.map((value) => value ?? '\u0000').join('\u0001')}`;
}
