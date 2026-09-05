import { describe, expect, it } from 'vitest';
import { evaluateNumericExpression } from '../src/internal/numericExpression';

const english = new Intl.NumberFormat('en-US');
const german = new Intl.NumberFormat('de-DE');

describe('numeric expression grammar', () => {
  it.each([
    ['5+10', 15], ['6*200', 1200], ['(5+10)*2', 30], ['2+3*4', 14],
    ['10-2-3', 5], ['100/4/5', 5], ['-5*-2', 10], ['-(5+1)', -6],
    ['5++3', 8], ['  42  ', 42], ['1,000+5', 1005], ['.5*4', 2],
  ])('evaluates %s with normal arithmetic precedence', (text, expected) => {
    expect(evaluateNumericExpression(text, english)).toEqual({ kind: 'value', value: expected });
  });

  it('reads localized operands and Unicode digits', () => {
    expect(evaluateNumericExpression('1.000,5*2', german)).toEqual({ kind: 'value', value: 2001 });
    expect(evaluateNumericExpression('٢,٥+٢,٥', german)).toEqual({ kind: 'value', value: 5 });
  });

  it.each(['', '   ', '5+', '5*', '(5+1', '(', '5++', '-', '5 + (2 *'])('classifies %j as incomplete', (text) => {
    expect(evaluateNumericExpression(text, english)).toEqual({ kind: 'incomplete' });
  });

  it.each(['abc', '5a', '5 5', '5)', '*5', '5+*3', '5/0', '5%2', '2^8'])('rejects %j', (text) => {
    expect(evaluateNumericExpression(text, english)).toEqual({ kind: 'invalid' });
  });

  it('rejects pathological depth, length, and non-finite arithmetic', () => {
    expect(evaluateNumericExpression(`${'('.repeat(40)}1${')'.repeat(40)}`, english)).toEqual({ kind: 'invalid' });
    expect(evaluateNumericExpression(Array.from({ length: 200 }, () => '1').join('+'), english)).toEqual({ kind: 'invalid' });
    expect(evaluateNumericExpression(`${Number.MAX_VALUE}*2`, english)).toEqual({ kind: 'invalid' });
  });
});
