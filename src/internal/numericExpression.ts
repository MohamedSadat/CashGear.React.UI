const MAXIMUM_LENGTH = 256;
const MAXIMUM_DEPTH = 32;
const ARABIC_ZERO = '٠'.charCodeAt(0);
const EASTERN_ZERO = '۰'.charCodeAt(0);

export type NumericExpressionResult =
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'invalid' };

function normalizeDigit(character: string): string {
  const code = character.charCodeAt(0);
  if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) return String(code - ARABIC_ZERO);
  if (code >= EASTERN_ZERO && code <= EASTERN_ZERO + 9) return String(code - EASTERN_ZERO);
  return character;
}

function separators(formatter: Intl.NumberFormat): { readonly decimal: string; readonly group: string } {
  const parts = new Intl.NumberFormat(formatter.resolvedOptions().locale, {
    numberingSystem: formatter.resolvedOptions().numberingSystem,
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).formatToParts(12345.6);
  return {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
  };
}

/** Internal arithmetic grammar used by CgSpinEdit. */
export function evaluateNumericExpression(text: string, formatter: Intl.NumberFormat): NumericExpressionResult {
  if (!text.trim()) return { kind: 'incomplete' };
  if (text.length > MAXIMUM_LENGTH) return { kind: 'invalid' };
  const { decimal, group } = separators(formatter);
  if ([decimal, group].some((separator) => [...separator].some((character) => '+-*/()'.includes(character)))) {
    return { kind: 'invalid' };
  }

  class Parser {
    private index = 0;

    get atEnd(): boolean { return this.index >= text.length; }

    skipWhitespace(): void {
      while (!this.atEnd && /\s/u.test(text[this.index]!)) this.index++;
    }

    parseExpression(depth: number): NumericExpressionResult {
      if (depth > MAXIMUM_DEPTH) return { kind: 'invalid' };
      let left = this.parseTerm(depth);
      if (left.kind !== 'value') return left;
      while (true) {
        this.skipWhitespace();
        const operator = text[this.index];
        if (operator !== '+' && operator !== '-') return left;
        this.index++;
        const right = this.parseTerm(depth);
        if (right.kind !== 'value') return right;
        const value: number = operator === '+' ? left.value + right.value : left.value - right.value;
        if (!Number.isFinite(value)) return { kind: 'invalid' };
        left = { kind: 'value', value };
      }
    }

    private parseTerm(depth: number): NumericExpressionResult {
      let left = this.parseFactor(depth);
      if (left.kind !== 'value') return left;
      while (true) {
        this.skipWhitespace();
        const operator = text[this.index];
        if (operator !== '*' && operator !== '/') return left;
        this.index++;
        const right = this.parseFactor(depth);
        if (right.kind !== 'value') return right;
        if (operator === '/' && right.value === 0) return { kind: 'invalid' };
        const value: number = operator === '*' ? left.value * right.value : left.value / right.value;
        if (!Number.isFinite(value)) return { kind: 'invalid' };
        left = { kind: 'value', value };
      }
    }

    private parseFactor(depth: number): NumericExpressionResult {
      if (depth > MAXIMUM_DEPTH) return { kind: 'invalid' };
      this.skipWhitespace();
      if (this.atEnd) return { kind: 'incomplete' };
      const operator = text[this.index];
      if (operator === '+' || operator === '-') {
        this.index++;
        const result = this.parseFactor(depth + 1);
        if (result.kind !== 'value') return result;
        const value = operator === '-' ? -result.value : result.value;
        return Number.isFinite(value) ? { kind: 'value', value } : { kind: 'invalid' };
      }
      return this.parsePrimary(depth);
    }

    private parsePrimary(depth: number): NumericExpressionResult {
      this.skipWhitespace();
      if (this.atEnd) return { kind: 'incomplete' };
      if (text[this.index] !== '(') return this.readNumber();
      if (depth >= MAXIMUM_DEPTH) return { kind: 'invalid' };
      this.index++;
      const inner = this.parseExpression(depth + 1);
      if (inner.kind !== 'value') return inner;
      this.skipWhitespace();
      if (this.atEnd) return { kind: 'incomplete' };
      if (text[this.index] !== ')') return { kind: 'invalid' };
      this.index++;
      return inner;
    }

    private readNumber(): NumericExpressionResult {
      const start = this.index;
      let sawDigit = false;
      let sawDecimal = false;
      let canonical = '';
      while (!this.atEnd) {
        const character = text[this.index]!;
        const digit = normalizeDigit(character);
        if (/\d/u.test(digit)) {
          sawDigit = true;
          canonical += digit;
          this.index++;
          continue;
        }
        if (!sawDecimal && decimal && text.startsWith(decimal, this.index)) {
          sawDecimal = true;
          canonical += '.';
          this.index += decimal.length;
          continue;
        }
        const afterGroup = this.index + group.length;
        if (!sawDecimal && sawDigit && group && text.startsWith(group, this.index) &&
            afterGroup < text.length && /\d/u.test(normalizeDigit(text[afterGroup]!))) {
          this.index = afterGroup;
          continue;
        }
        break;
      }
      if (!sawDigit) {
        this.index = start;
        return { kind: 'invalid' };
      }
      const value = Number(canonical);
      return Number.isFinite(value) ? { kind: 'value', value } : { kind: 'invalid' };
    }
  }

  const parser = new Parser();
  const result = parser.parseExpression(0);
  if (result.kind !== 'value') return result;
  parser.skipWhitespace();
  return parser.atEnd ? result : { kind: 'invalid' };
}
