import type { CgDecimalValue } from '../components/RangeSelector/CgRangeSelector.types';
const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
export function normalizeDecimalString(input: string): CgDecimalValue {
  const value = input.trim();
  const match = DECIMAL.exec(value);
  if (!match) throw new RangeError('CgRangeSelector decimal values must use base-10 notation without an exponent.');
  const integer = (match[2] ?? '').replace(/^0+(?=\d)/u, '') || '0';
  const fraction = (match[3] ?? '').replace(/0+$/u, '');
  const zero = /^0+$/u.test(integer) && fraction.length === 0;
  return `${match[1] === '-' && !zero ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}` as CgDecimalValue;
}
