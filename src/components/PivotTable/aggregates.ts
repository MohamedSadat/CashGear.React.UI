import type { CgPivotAggregateState, CgPivotCalculatedMeasure, CgPivotCalculatedOperand, CgPivotField, CgPivotSummaryType, CgPivotValue, CgPivotValueType } from './CgPivotTable.types';
import { addDecimal, compareDecimal, decimal, decimalText, divideDecimal, multiplyDecimal, roundDecimal, subtractDecimal } from './decimal';
import { CgPivotError } from './model';
import { temporalKey } from './temporal';
const numeric = (type: CgPivotValueType) => type === 'decimal' || type === 'number';
export function compareValues(a: CgPivotValue, b: CgPivotValue, type: CgPivotValueType, locale = 'en-US'): number {
    if (a === b)
        return 0;
    if (a === null)
        return -1;
    if (b === null)
        return 1;
    if (numeric(type))
        return compareDecimal(decimal(String(a)), decimal(String(b)));
    if(type==='date'||type==='dateTime'||type==='instant'){
        const left=temporalKey(String(a),type),right=temporalKey(String(b),type);
        return left<right?-1:left>right?1:0;
    }
    return new Intl.Collator(locale).compare(String(a), String(b));
}
export function pivotValueKey(value: CgPivotValue, type: CgPivotValueType = 'text'): string {
    if (value === null)
        return 'null:';
    if(type==='date'||type==='dateTime'||type==='instant')return `${type}:${temporalKey(String(value),type)}`;
    return `${type}:${numeric(type) ? decimalText(decimal(String(value))) : String(value)}`;
}
export function pivotPathKey(keys: ReadonlyArray<string>): string { return keys.map(k => k.replaceAll('%', '%25').replaceAll('\u001f', '%1F')).join('\u001f'); }
class Aggregate implements CgPivotAggregateState {
    private sum = decimal('0');
    private value: CgPivotValue = null;
    private amount = 0;
    private keys = new Set<string>();
    private readonly kind: CgPivotSummaryType;
    private readonly type: CgPivotValueType;
    private readonly locale: string;
    constructor(kind: CgPivotSummaryType, type: CgPivotValueType, locale: string) { this.kind = kind; this.type = type; this.locale = locale; }
    get count(): number { return this.kind === 'distinctCount' ? this.keys.size : this.amount; }
    accumulate(value: CgPivotValue): void {
        if (value === null)
            return;
        if (this.kind === 'distinctCount') {
            this.keys.add(pivotValueKey(value, this.type));
            return;
        }
        if (this.kind === 'sum' || this.kind === 'average') {
            if (typeof value === 'boolean')
                return;
            this.sum = addDecimal(this.sum, decimal(value));
        }
        if (this.kind === 'minimum' || this.kind === 'maximum') {
            if (this.amount === 0 || (this.kind === 'minimum' ? compareValues(value, this.value, this.type, this.locale) < 0 : compareValues(value, this.value, this.type, this.locale) > 0))
                this.value = value;
        }
        this.amount++;
        if (!Number.isSafeInteger(this.amount))
            throw new RangeError('Pivot count overflow.');
    }
    merge(other: CgPivotAggregateState): void {
        if (!(other instanceof Aggregate) || other.kind !== this.kind || other.type !== this.type)
            throw new CgPivotError('Incompatible aggregate states.');
        if (this.kind === 'distinctCount') {
            for (const key of other.keys)
                this.keys.add(key);
            return;
        }
        if (this.kind === 'sum' || this.kind === 'average')
            this.sum = addDecimal(this.sum, other.sum);
        if ((this.kind === 'minimum' || this.kind === 'maximum') && other.amount) {
            const old = this.amount;
            this.accumulate(other.value);
            this.amount = old;
        }
        this.amount += other.amount;
        if (!Number.isSafeInteger(this.amount))
            throw new RangeError('Pivot count overflow.');
    }
    finalizeValue(): CgPivotValue { if (this.kind === 'count' || this.kind === 'distinctCount')
        return this.count; if (!this.amount)
        return null; if (this.kind === 'sum')
        return decimalText(this.sum); if (this.kind === 'average')
        return decimalText(divideDecimal(this.sum, decimal(this.amount))); return this.value; }
}
export function createPivotAggregate(kind: Exclude<CgPivotSummaryType, 'custom'>, type: CgPivotValueType = 'decimal', locale = 'en-US'): CgPivotAggregateState { return new Aggregate(kind, type, locale); }
export interface CalculatedState<T> {
    accumulate(item: T): void;
    merge(other: CalculatedState<T>): void;
    finalizeValue(): CgPivotValue;
    readonly count: number;
}
export function createPivotCalculatedState<T>(definition: CgPivotCalculatedMeasure<T>): CalculatedState<T> {
    const operands = [definition.left, definition.right, definition.denominator].filter((o): o is CgPivotCalculatedOperand<T> => Boolean(o));
    if (new Set(operands.map(o => o.key)).size !== operands.length)
        throw new CgPivotError('Calculated operand keys must be unique.');
    if (definition.operation === 'difference' && !definition.right || definition.operation === 'ratio' && !definition.denominator || definition.operation === 'differenceRatio' && (!definition.right || !definition.denominator))
        throw new CgPivotError('Missing calculated operands.');
    const states = operands.map(o => createPivotAggregate(o.summaryType ?? 'sum'));
    const precision = definition.precision ?? 4;
    roundDecimal(decimal(0), precision);
    class State implements CalculatedState<T> {
        readonly identity = JSON.stringify([definition.key, definition.operation, operands.map(o => [o.key, o.summaryType ?? 'sum']), definition.scale ?? '1', precision]);
        readonly aggregates = states;
        get count() { return Math.max(0, ...states.map(s => s.count)); }
        accumulate(item: T) { operands.forEach((o, i) => states[i]!.accumulate(o.getValue(item))); }
        merge(other: CalculatedState<T>) {
            const candidate = other as Partial<State>;
            if (candidate.identity !== this.identity || !candidate.aggregates)
                throw new CgPivotError('Incompatible calculated states.');
            states.forEach((s, i) => s.merge(candidate.aggregates![i]!));
        }
        finalizeValue(): CgPivotValue {
            const values = states.map(s => s.finalizeValue());
            if (values.some(v => v === null))
                return null;
            const left = decimal(String(values[0]));
            let result = left;
            if (definition.operation !== 'ratio')
                result = subtractDecimal(left, decimal(String(values[1])));
            if (definition.operation !== 'difference') {
                const denominator = decimal(String(values.at(-1)));
                if (denominator.coefficient === 0n)
                    return null;
                result = divideDecimal(result, denominator);
            }
            return decimalText(roundDecimal(multiplyDecimal(result, decimal(definition.scale ?? '1')), precision));
        }
    }
    return new State();
}
function pair<T>(key: string, operation: CgPivotCalculatedMeasure<T>['operation'], left: (i: T) => CgPivotValue, right: (i: T) => CgPivotValue, percentage = false): CgPivotCalculatedMeasure<T> { return { key, operation, left: { key: 'left', getValue: left }, ...(operation === 'difference' ? { right: { key: 'right', getValue: right } } : { denominator: { key: 'denominator', getValue: right } }), scale: percentage ? '100' : '1', precision: 4 }; }
export const CgPivotCalculatedMeasures = {
    difference: <T>(key: string, a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair(key, 'difference', a, b),
    ratio: <T>(key: string, a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair(key, 'ratio', a, b),
    percentage: <T>(key: string, a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair(key, 'ratio', a, b, true),
    differenceRatio: <T>(key: string, a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue, d: (i: T) => CgPivotValue, scale = '1'): CgPivotCalculatedMeasure<T> => ({ key, operation: 'differenceRatio', left: { key: 'left', getValue: a }, right: { key: 'right', getValue: b }, denominator: { key: 'denominator', getValue: d }, scale, precision: 4 }),
    grossMargin: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair('gross-margin', 'difference', a, b),
    grossMarginPercentage: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue): CgPivotCalculatedMeasure<T> => ({ key: 'gross-margin-percentage', operation: 'differenceRatio', left: { key: 'revenue', getValue: a }, right: { key: 'cost', getValue: b }, denominator: { key: 'base', getValue: a }, scale: '100', precision: 4 }),
    averageUnitPrice: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair('average-unit-price', 'ratio', a, b),
    budgetVariance: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair('budget-variance', 'difference', a, b),
    budgetVariancePercentage: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue): CgPivotCalculatedMeasure<T> => ({ key: 'budget-variance-percentage', operation: 'differenceRatio', left: { key: 'actual', getValue: a }, right: { key: 'budget', getValue: b }, denominator: { key: 'base', getValue: b }, scale: '100', precision: 4 }),
    fulfilmentPercentage: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair('fulfilment-percentage', 'ratio', a, b, true),
    inventoryTurnover: <T>(a: (i: T) => CgPivotValue, b: (i: T) => CgPivotValue) => pair('inventory-turnover', 'ratio', a, b),
};
export function fieldAggregate<T>(field: CgPivotField<T>, summary: CgPivotSummaryType, locale: string): CalculatedState<T> {
    if (field.calculated)
        return createPivotCalculatedState(field.calculated);
    const state = summary === 'custom' ? field.customAggregate?.createState() : createPivotAggregate(summary, field.valueType, locale);
    if (!state)
        throw new CgPivotError(`No local aggregate for '${field.key}'.`);
    return { accumulate: item => state.accumulate(field.getValue!(item)), merge: () => { throw new CgPivotError('Use aggregate merge directly.'); }, finalizeValue: () => state.finalizeValue(), get count() { return state.count; } };
}
