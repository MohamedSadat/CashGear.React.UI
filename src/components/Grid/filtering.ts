/* eslint-disable @typescript-eslint/no-base-to-string -- filter values are serializable caller input normalized by column type. */
import type { CgGridColumnDescriptor, CgGridFilterCondition, CgGridFilterNode } from './CgGrid.types';
import { formatGridValue } from './columns';

function blank(value: unknown): boolean { return value === null || value === undefined || (typeof value === 'string' && value.trim() === ''); }
function asDate(value: unknown): Date | null { const date = value instanceof Date ? value : new Date(String(value)); return Number.isNaN(date.getTime()) ? null : date; }
function hasExplicitTime(value: unknown): boolean { return value instanceof Date || (typeof value === 'string' && /T\d{2}:\d{2}|\s\d{1,2}:\d{2}/.test(value)); }
function dayStart(date: Date): number { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
function dayEnd(date: Date): number { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1; }
function compare(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (a instanceof Date || b instanceof Date) { const left = asDate(a); const right = asDate(b); return left && right ? left.getTime() - right.getTime() : null; }
  if (typeof a === 'number' || typeof b === 'number') { const left = Number(a); const right = Number(b); return Number.isFinite(left) && Number.isFinite(right) ? left - right : null; }
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(Boolean(a)) - Number(Boolean(b));
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

function conditionMatches<TItem>(condition: CgGridFilterCondition, item: TItem, column: CgGridColumnDescriptor<TItem> | undefined): boolean {
  if (!column?.accessor) return true;
  const raw = column.accessor(item);
  const op = condition.operator;
  if (op === 'isNull') return raw === null || raw === undefined;
  if (op === 'isNotNull') return raw !== null && raw !== undefined;
  if (op === 'isBlank') return blank(raw);
  if (op === 'isNotBlank') return !blank(raw);
  if (column.type === 'date') {
    const left = asDate(raw); const first = asDate(condition.value); const second = asDate(condition.secondValue);
    if (!left || !first) return false;
    const instant = hasExplicitTime(condition.value);
    const l = left.getTime(); const low = instant ? first.getTime() : dayStart(first); const high = instant ? first.getTime() : dayEnd(first);
    if (op === 'equals') return l >= low && l <= high;
    if (op === 'notEquals') return l < low || l > high;
    if (op === 'lessThan') return l < low;
    if (op === 'lessThanOrEqual') return l <= high;
    if (op === 'greaterThan') return l > high;
    if (op === 'greaterThanOrEqual') return l >= low;
    if (op === 'between' && second) { const upper = hasExplicitTime(condition.secondValue) ? second.getTime() : dayEnd(second); return l >= Math.min(low, upper) && l <= Math.max(low, upper); }
  }
  const display = formatGridValue(column, item);
  const needle = condition.value === null || condition.value === undefined ? '' : String(condition.value);
  const leftText = display.toLocaleLowerCase(); const rightText = needle.toLocaleLowerCase();
  if (op === 'contains') return leftText.includes(rightText);
  if (op === 'notContains') return !leftText.includes(rightText);
  if (op === 'startsWith') return leftText.startsWith(rightText);
  if (op === 'endsWith') return leftText.endsWith(rightText);
  const first = compare(raw, condition.value);
  if (first === null) return false;
  if (op === 'equals') return first === 0;
  if (op === 'notEquals') return first !== 0;
  if (op === 'greaterThan') return first > 0;
  if (op === 'greaterThanOrEqual') return first >= 0;
  if (op === 'lessThan') return first < 0;
  if (op === 'lessThanOrEqual') return first <= 0;
  if (op === 'between') { const second = compare(raw, condition.secondValue); if (second === null) return false; return first >= 0 && second <= 0 || first <= 0 && second >= 0; }
  return true;
}

export function evaluateGridFilter<TItem>(node: CgGridFilterNode | null, item: TItem, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>): boolean {
  if (!node) return true;
  if (node.kind === 'condition') return conditionMatches(node, item, columns.get(node.fieldId));
  return node.operator === 'and' ? node.children.every((child) => evaluateGridFilter(child, item, columns)) : node.children.some((child) => evaluateGridFilter(child, item, columns));
}

export function replaceFilterRowConditions(filter: CgGridFilterNode | null, conditions: ReadonlyArray<CgGridFilterCondition>): CgGridFilterNode | null {
  function strip(node: CgGridFilterNode): CgGridFilterNode | null {
    if (node.kind === 'condition') return node.source === 'filterRow' ? null : node;
    const children = node.children.map(strip).filter((child): child is CgGridFilterNode => child !== null);
    return children.length ? { ...node, children } : null;
  }
  const caller = filter ? strip(filter) : null;
  const owned = conditions.map((condition) => ({ ...condition, source: 'filterRow' as const }));
  if (!caller && owned.length === 0) return null;
  return { kind: 'group', operator: 'and', children: [...(caller ? [caller] : []), ...owned] };
}

export function pruneGridFilter(node: CgGridFilterNode | null, knownIds: ReadonlySet<string>): CgGridFilterNode | null {
  if (!node) return null;
  if (node.kind === 'condition') return knownIds.has(node.fieldId) ? node : null;
  const children = node.children.map((child) => pruneGridFilter(child, knownIds)).filter((child): child is CgGridFilterNode => child !== null);
  return children.length ? { ...node, children } : null;
}
