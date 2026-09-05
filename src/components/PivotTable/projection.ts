import type { CgPivotAxisNode, CgPivotField, CgPivotLayout, CgPivotResult, CgPivotValue } from './CgPivotTable.types';
import { decimal, decimalText, multiplyDecimal, roundDecimal } from './decimal';
export interface PivotAxisEntry {
    readonly key: string;
    readonly node: CgPivotAxisNode | null;
    readonly label: string;
    readonly total: boolean;
    readonly grand: boolean;
    readonly expanded: boolean;
}
export function projectPivotAxis<T>(nodes: ReadonlyArray<CgPivotAxisNode>, fields: ReadonlyArray<CgPivotField<T>>, expanded: ReadonlyArray<string>, initialized: boolean, showGrand: boolean, placement: 'near' | 'far', grandLabel: string, all = false): PivotAxisEntry[] {
    const entries: PivotAxisEntry[] = [];
    const open = new Set(expanded);
    const visit = (node: CgPivotAxisNode) => {
        const isOpen = all || !initialized || open.has(node.id);
        const showSubtotal = fields.find(f => f.key === node.fieldKey)?.showSubtotals !== false;
        const entry = { key: node.id, node, label: node.member.isBlank ? '(Blank)' : node.member.displayText, total: node.isSubtotal, grand: false, expanded: isOpen };
        if (!node.children.length || !isOpen || showSubtotal && placement === 'near')
            entries.push(entry);
        if (isOpen)
            node.children.forEach(visit);
        if (node.children.length && isOpen && showSubtotal && placement === 'far')
            entries.push(entry);
    };
    nodes.forEach(visit);
    if (showGrand || !nodes.length) {
        const grand = { key: '', node: null, label: grandLabel, total: true, grand: true, expanded: false };
        if (placement === 'near')
            entries.unshift(grand);
        else
            entries.push(grand);
    }
    return entries;
}
export function pivotProjection<T>(result: CgPivotResult, layout: CgPivotLayout, fields: ReadonlyArray<CgPivotField<T>>, grandLabel = 'Grand Total', all = false) {
    const rows = projectPivotAxis(result.rowHierarchy, fields, layout.expandedRowPaths, layout.expansionStateInitialized, layout.showRowGrandTotals, layout.rowTotalPlacement, grandLabel, all);
    const axes = projectPivotAxis(result.columnHierarchy, fields, layout.expandedColumnPaths, layout.expansionStateInitialized, layout.showColumnGrandTotals, layout.columnTotalPlacement, grandLabel, all);
    const measures = layout.fields.filter(f => f.area === 'data' && f.visible).sort((a, b) => a.areaIndex - b.areaIndex);
    const columns = axes.flatMap(axis => measures.map(measure => ({ axis, measure, field: fields.find(f => f.key === measure.key)! })));
    return { rows, columns };
}
export function formatPivotValue<T>(value: CgPivotValue, field: CgPivotField<T>, locale = 'en-US'): string {
    if (value === null)
        return '';
    if (field.formatValue)
        return field.formatValue(value, locale);
    if (typeof value === 'boolean')
        return String(value);
    const format = field.cellFormat;
    const pattern = format ? /^([NnFfPpCc])(\d{0,2})$/.exec(format) : null;
    if ((field.valueType === 'decimal' || field.valueType === 'number' || field.calculated) && pattern) {
        const precision = Number(pattern[2] || 2);
        let number = decimal(value);
        const kind = pattern[1]!.toUpperCase();
        if (kind === 'P')
            number = multiplyDecimal(number, decimal(100));
        const text = decimalText(roundDecimal(number, precision));
        const negative = text.startsWith('-');
        const [integer, fraction = ''] = text.replace(/^-/, '').split('.');
        const formatter = new Intl.NumberFormat(locale, { useGrouping: kind !== 'F', maximumFractionDigits: 0 });
        const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
        const separator = parts.find(p => p.type === 'decimal')?.value ?? '.';
        const digits = new Intl.NumberFormat(locale, { useGrouping: false });
        const localized = [...fraction.padEnd(precision, '0')].map(d => digits.format(Number(d))).join('');
        const amount = `${formatter.format(BigInt(integer!))}${precision ? separator + localized : ''}`;
        if (kind === 'C' || kind === 'P') {
            const template = new Intl.NumberFormat(locale, { style: kind === 'C' ? 'currency' : 'percent', currency: field.currency ?? 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).formatToParts(negative ? -1 : 1);
            return template.map(p => p.type === 'integer' ? amount : p.type === 'group' ? '' : p.value).join('');
        }
        return `${negative ? '-' : ''}${amount}`;
    }
    return String(value);
}
