import type {
  CgSplitterPaneCollapsedDetails,
  CgSplitterPaneDescriptor,
  CgSplitterPaneExpandedDetails,
  CgSplitterPaneResizedDetails,
  CgSplitterPaneResizingDetails,
  CgSplitterState,
  CgSplitterStateChangeDetails,
} from './CgSplitter.types';

export interface ParsedSplitterLength {
  readonly value: number;
  readonly unit: string;
  readonly css: string;
  readonly flexible: boolean;
}

export interface NormalizedSplitterPane {
  readonly descriptor: CgSplitterPaneDescriptor;
  readonly key: string;
  readonly size: string;
  readonly minimumSize: string;
  readonly maximumSize?: string;
  readonly resizable: boolean;
  readonly collapsible: boolean;
  readonly defaultCollapsed: boolean;
  readonly visible: boolean;
  readonly hasCollapsedContent: boolean;
  readonly style?: Readonly<Record<string, string | number>>;
  readonly dataAttributes?: Readonly<Record<string, string | number | boolean | undefined>>;
}

const FIXED_UNITS = new Set(['px', '%', 'rem', 'em', 'vw', 'vh', 'vmin', 'vmax', 'ch']);
const LENGTH_PATTERN = /^(?:(\d+(?:\.\d*)?|\.\d+))(px|%|rem|em|vw|vh|vmin|vmax|ch|fr)?$/iu;

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function fail(name: string, message: string): never {
  throw new Error(`CgSplitter ${name} ${message}`);
}

export function parseSplitterLength(
  value: number | string | undefined,
  name: string,
  allowFlexible: boolean,
  fallback: string,
): ParsedSplitterLength {
  const candidate = value === undefined || (typeof value === 'string' && !value.trim()) ? fallback : value;
  if (typeof candidate === 'number') {
    if (!Number.isFinite(candidate) || candidate < 0) fail(name, 'must be a finite nonnegative CSS length.');
    return Object.freeze({ value: candidate, unit: 'px', css: `${formatNumber(candidate)}px`, flexible: false });
  }

  const text = candidate.trim().toLowerCase();
  if (text.endsWith('*')) {
    if (!allowFlexible) fail(name, "does not accept flexible '*' values.");
    const weightText = text.slice(0, -1).trim();
    const weight = weightText ? Number(weightText) : 1;
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(weightText || '1') || !Number.isFinite(weight) || weight <= 0) {
      fail(name, 'flexible weight must be greater than zero.');
    }
    return Object.freeze({ value: weight, unit: 'fr', css: `${formatNumber(weight)}fr`, flexible: true });
  }

  const match = LENGTH_PATTERN.exec(text);
  if (!match) fail(name, 'must be a nonnegative CSS length or a positive fr/* weight.');
  const number = Number(match[1]);
  const rawUnit = (match[2] ?? 'px').toLowerCase();
  if (!Number.isFinite(number) || number < 0) fail(name, 'contains an invalid numeric value.');
  if (rawUnit === 'fr') {
    if (!allowFlexible) fail(name, 'does not accept flexible fr values.');
    if (number <= 0) fail(name, 'flexible weight must be greater than zero.');
    return Object.freeze({ value: number, unit: 'fr', css: `${formatNumber(number)}fr`, flexible: true });
  }
  if (!FIXED_UNITS.has(rawUnit)) fail(name, 'contains an unsupported CSS unit.');
  return Object.freeze({ value: number, unit: rawUnit, css: `${formatNumber(number)}${rawUnit}`, flexible: false });
}

function copyDataAttributes(
  attributes: CgSplitterPaneDescriptor['dataAttributes'],
  key: string,
): Readonly<Record<string, string | number | boolean | undefined>> | undefined {
  if (!attributes) return undefined;
  const copy: Record<string, string | number | boolean | undefined> = {};
  for (const [name, value] of Object.entries(attributes)) {
    if (!name.toLowerCase().startsWith('data-')) fail(`pane '${key}'`, `data attribute '${name}' must start with data-.`);
    if (name.toLowerCase().startsWith('data-cg-')) fail(`pane '${key}'`, `cannot replace component-owned '${name}'.`);
    copy[name] = value;
  }
  return Object.freeze(copy);
}

export function normalizeSplitterPanes(
  panes: ReadonlyArray<CgSplitterPaneDescriptor>,
): ReadonlyArray<NormalizedSplitterPane> {
  if (!Array.isArray(panes) || panes.length === 0) fail('panes', 'must contain at least one descriptor.');
  const keys = new Set<string>();
  const normalized = panes.map((descriptor: CgSplitterPaneDescriptor, index: number): NormalizedSplitterPane => {
    if (!descriptor || typeof descriptor !== 'object') fail(`pane at index ${index}`, 'must be a descriptor.');
    const key = typeof descriptor.key === 'string' ? descriptor.key.trim() : '';
    if (!key) fail(`pane at index ${index}`, 'requires a nonempty key.');
    if (keys.has(key)) fail('panes', `contain duplicate key '${key}'.`);
    keys.add(key);
    if (typeof descriptor.renderContent !== 'function') fail(`pane '${key}'`, 'requires renderContent.');

    const size = parseSplitterLength(descriptor.size, `pane '${key}' size`, true, '1fr');
    const minimum = parseSplitterLength(descriptor.minimumSize, `pane '${key}' minimumSize`, false, '0px');
    const maximum = descriptor.maximumSize === undefined || (typeof descriptor.maximumSize === 'string' && !descriptor.maximumSize.trim())
      ? undefined
      : parseSplitterLength(descriptor.maximumSize, `pane '${key}' maximumSize`, false, '0px');
    if (maximum && maximum.unit === minimum.unit && maximum.value < minimum.value) {
      fail(`pane '${key}'`, 'maximumSize cannot be smaller than minimumSize when units match.');
    }
    const collapsible = descriptor.collapsible ?? false;
    const defaultCollapsed = descriptor.defaultCollapsed ?? false;
    if (defaultCollapsed && !collapsible) fail(`pane '${key}'`, 'cannot default to collapsed unless collapsible is true.');
    if (descriptor.id !== undefined && !descriptor.id.trim()) fail(`pane '${key}'`, 'id cannot be empty.');

    const style = descriptor.style ? Object.freeze({ ...descriptor.style }) as Readonly<Record<string, string | number>> : undefined;
    const dataAttributes = copyDataAttributes(descriptor.dataAttributes, key);
    const descriptorSnapshot = Object.freeze({
      ...descriptor,
      key,
      ...(style ? { style } : {}),
      ...(dataAttributes ? { dataAttributes } : {}),
    });
    return Object.freeze({
      descriptor: descriptorSnapshot,
      key,
      size: size.css,
      minimumSize: minimum.css,
      ...(maximum ? { maximumSize: maximum.css } : {}),
      resizable: descriptor.resizable ?? true,
      collapsible,
      defaultCollapsed,
      visible: descriptor.visible ?? true,
      hasCollapsedContent: typeof descriptor.renderCollapsed === 'function',
      ...(style ? { style } : {}),
      ...(dataAttributes ? { dataAttributes } : {}),
    });
  });
  if (!normalized.some((pane) => pane.visible)) fail('panes', 'must contain at least one visible descriptor.');
  return Object.freeze(normalized);
}

export function freezeSplitterState(
  panes: ReadonlyArray<{ readonly key: string; readonly size: string }>,
  collapsedPaneKeys: ReadonlyArray<string>,
): CgSplitterState {
  return Object.freeze({
    version: 1 as const,
    panes: Object.freeze(panes.map((pane) => Object.freeze({ key: pane.key, size: pane.size }))),
    collapsedPaneKeys: Object.freeze([...collapsedPaneKeys]),
  });
}

export function normalizeSplitterState(
  panes: ReadonlyArray<NormalizedSplitterPane>,
  state?: CgSplitterState,
): CgSplitterState {
  if (state && state.version !== 1) fail('state', `version ${String(state.version)} is not supported.`);
  const validKeys = new Set(panes.map((pane) => pane.key));
  const stored = new Map<string, string>();
  for (const item of state?.panes ?? []) {
    const key = typeof item?.key === 'string' ? item.key.trim() : '';
    if (!key || !validKeys.has(key) || stored.has(key)) continue;
    try {
      stored.set(key, parseSplitterLength(item.size, `state pane '${key}' size`, true, '1fr').css);
    } catch {
      // Persisted state is untrusted; a later valid duplicate may still supply this key.
    }
  }

  const requestedCollapsed = new Set(
    (state?.collapsedPaneKeys ?? []).map((key) => typeof key === 'string' ? key.trim() : '').filter(Boolean),
  );
  const collapsed = panes
    .filter((pane) => pane.collapsible && (state ? requestedCollapsed.has(pane.key) : pane.defaultCollapsed))
    .map((pane) => pane.key);
  if (!panes.some((pane) => pane.visible && !collapsed.includes(pane.key))) {
    const firstVisible = panes.find((pane) => pane.visible);
    if (firstVisible) collapsed.splice(collapsed.indexOf(firstVisible.key), 1);
  }
  return freezeSplitterState(
    panes.map((pane) => ({ key: pane.key, size: stored.get(pane.key) ?? pane.size })),
    panes.filter((pane) => collapsed.includes(pane.key)).map((pane) => pane.key),
  );
}

export function freezeSplitterDetails<T extends
  CgSplitterPaneResizingDetails |
  CgSplitterPaneResizedDetails |
  CgSplitterPaneCollapsedDetails |
  CgSplitterPaneExpandedDetails |
  CgSplitterStateChangeDetails
>(details: T): T {
  return Object.freeze({ ...details }) as unknown as T;
}
