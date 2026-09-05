/** Checked 96-bit decimal arithmetic. All rounding uses round-half-to-even. */
export interface Decimal {
    readonly coefficient: bigint;
    readonly scale: number;
}
const MAX = 79228162514264337593543950335n;
const abs = (n: bigint) => n < 0n ? -n : n;
function quotient(n: bigint, d: bigint): bigint {
    const sign = (n < 0n) !== (d < 0n) ? -1n : 1n;
    const a = abs(n);
    const b = abs(d);
    const q = a / b;
    const r = a % b;
    return sign * (q + (2n * r > b || 2n * r === b && q % 2n !== 0n ? 1n : 0n));
}
function checked(coefficient: bigint, scale: number): Decimal {
    const original = coefficient;
    const originalScale = scale;
    while ((scale > 28 || abs(coefficient) > MAX) && scale > 0) {
        scale--;
        coefficient = quotient(original, 10n ** BigInt(originalScale - scale));
    }
    if (abs(coefficient) > MAX)
        throw new RangeError('Pivot decimal overflow.');
    while (scale > 0 && coefficient % 10n === 0n) {
        coefficient /= 10n;
        scale--;
    }
    return { coefficient, scale };
}
export function decimal(value: string | number): Decimal {
    if (typeof value === 'number' && !Number.isFinite(value))
        throw new RangeError('Pivot numbers must be finite.');
    const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(String(value));
    if (!match || String(value).length > 256)
        throw new RangeError('Invalid pivot decimal.');
    const exponent = Number(match[4] ?? 0);
    if (Math.abs(exponent) > 100)
        throw new RangeError('Pivot decimal exponent exceeds bounds.');
    const fraction = match[3] ?? '';
    const scale = fraction.length - exponent;
    const coefficient = BigInt(match[2]! + fraction) * (match[1] === '-' ? -1n : 1n);
    return checked(scale < 0 ? coefficient * 10n ** BigInt(-scale) : coefficient, Math.max(0, scale));
}
export function decimalText(value: Decimal): string {
    const negative = value.coefficient < 0n;
    const digits = abs(value.coefficient).toString().padStart(value.scale + 1, '0');
    return `${negative ? '-' : ''}${value.scale ? `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}` : digits}`;
}
export function compareDecimal(a: Decimal, b: Decimal): number { const scale = Math.max(a.scale, b.scale); const n = a.coefficient * 10n ** BigInt(scale - a.scale) - b.coefficient * 10n ** BigInt(scale - b.scale); return n < 0n ? -1 : n > 0n ? 1 : 0; }
export function addDecimal(a: Decimal, b: Decimal): Decimal { const scale = Math.max(a.scale, b.scale); return checked(a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale), scale); }
export function subtractDecimal(a: Decimal, b: Decimal): Decimal { return addDecimal(a, { ...b, coefficient: -b.coefficient }); }
export function multiplyDecimal(a: Decimal, b: Decimal): Decimal { return checked(a.coefficient * b.coefficient, a.scale + b.scale); }
export function divideDecimal(a: Decimal, b: Decimal): Decimal {
    if (!b.coefficient)
        throw new RangeError('Pivot division by zero.');
    for (let scale = 28; scale >= 0; scale--) {
        const power = scale + b.scale - a.scale;
        const coefficient = quotient(power >= 0 ? a.coefficient * 10n ** BigInt(power) : a.coefficient, power < 0 ? b.coefficient * 10n ** BigInt(-power) : b.coefficient);
        if (abs(coefficient) <= MAX)
            return checked(coefficient, scale);
    }
    throw new RangeError('Pivot decimal overflow.');
}
export function roundDecimal(a: Decimal, precision: number): Decimal {
    if (!Number.isInteger(precision) || precision < 0 || precision > 28)
        throw new RangeError('Pivot precision must be 0–28.');
    return precision >= a.scale ? a : checked(quotient(a.coefficient, 10n ** BigInt(a.scale - precision)), precision);
}
