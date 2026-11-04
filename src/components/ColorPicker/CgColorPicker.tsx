import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useCgId, useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { useRovingGrid } from '../../internal/rovingGrid';
import { cx } from '../../utils';
import { applyTint, defaultTints, normalizeHexColor, sameTint } from './colorTint';
import styles from './CgColorPicker.module.css';
import type { CgColorPickerLabels, CgColorPickerProps, CgColorPickerSource, CgColorPickerStandardColor, CgColorPickerThemeColor, CgColorPickerValue } from './CgColorPicker.types';

type SwatchValue = Extract<CgColorPickerValue, { kind: 'theme' | 'rgb' }>;
type SwatchStyle = CSSProperties & { '--cg-color-picker-swatch': string };

interface Swatch {
  readonly key: string;
  readonly value: SwatchValue;
  readonly label: string;
  readonly source: CgColorPickerSource;
}

const PALETTE_COLUMNS = 10;
const NO_RECENT_COLORS: ReadonlyArray<CgColorPickerValue> = [];

const DEFAULT_LABELS: CgColorPickerLabels = {
  picker: 'Color picker',
  automatic: 'Automatic',
  none: 'No color',
  themeColors: 'Theme colors',
  standardColors: 'Standard colors',
  recentColors: 'Recent colors',
  customColor: 'More colors…',
  lighter: (name, percent) => `${name}, lighter ${percent}%`,
  darker: (name, percent) => `${name}, darker ${percent}%`,
};

const DEFAULT_STANDARD_COLORS: ReadonlyArray<CgColorPickerStandardColor> = [
  { name: 'Dark red', color: '#c00000' },
  { name: 'Red', color: '#ff0000' },
  { name: 'Orange', color: '#ffc000' },
  { name: 'Yellow', color: '#ffff00' },
  { name: 'Light green', color: '#92d050' },
  { name: 'Green', color: '#00b050' },
  { name: 'Light blue', color: '#00b0f0' },
  { name: 'Blue', color: '#0070c0' },
  { name: 'Dark blue', color: '#002060' },
  { name: 'Purple', color: '#7030a0' },
];

function sameColor(left: CgColorPickerValue | null, right: CgColorPickerValue): boolean {
  if (left?.kind !== right.kind) return false;
  if (left.kind === 'theme' && right.kind === 'theme') return left.key === right.key && sameTint(left.tint, right.tint);
  if (left.kind === 'rgb' && right.kind === 'rgb') return left.color.toLowerCase() === right.color.toLowerCase();
  return true;
}

function shadeLabel(name: string, tint: number, labels: CgColorPickerLabels) {
  const percent = Math.round(Math.abs(tint) * 100);
  return tint === 0 ? name : tint > 0 ? labels.lighter(name, percent) : labels.darker(name, percent);
}

/** One column per theme color, with the base colors on the first row and their shades below. */
function themeRows(colors: ReadonlyArray<CgColorPickerThemeColor>, labels: CgColorPickerLabels): ReadonlyArray<ReadonlyArray<Swatch | null>> {
  const keys = new Set<string>();
  const columns = colors.map(({ key, name, color, tints }) => {
    if (!key.trim()) throw new Error('CgColorPicker theme colors require a nonempty key.');
    if (keys.has(key)) throw new Error(`CgColorPicker contains duplicate theme color '${key}'.`);
    keys.add(key);
    const base = normalizeHexColor(color, `CgColorPicker theme color '${key}'`);
    return [0, ...(tints ?? defaultTints(base))].map((tint): Swatch => {
      if (!Number.isFinite(tint) || tint < -1 || tint > 1) throw new RangeError(`CgColorPicker theme color '${key}' has a tint outside -1 to 1.`);
      return { key: `theme:${key}:${tint}`, value: { kind: 'theme', key, tint, color: applyTint(base, tint) }, label: shadeLabel(name, tint, labels), source: 'theme' };
    });
  });
  const rowCount = Math.max(0, ...columns.map((column) => column.length));
  return Array.from({ length: rowCount }, (_, row) => columns.map((column) => column[row] ?? null));
}

function chunk<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

export const CgColorPicker = forwardRef<HTMLDivElement, CgColorPickerProps>(function CgColorPicker(
  { value, defaultValue = null, onValueChange, themeColors, standardColors = DEFAULT_STANDARD_COLORS, recentColors, defaultRecentColors = NO_RECENT_COLORS, onRecentColorsChange, maxRecentColors = PALETTE_COLUMNS, allowAutomatic = false, automaticColor, allowNone = false, allowCustomColor = false, disabled = false, direction = 'auto', labels, className, 'aria-label': nativeAriaLabel, ...nativeProps },
  forwardedRef,
) {
  if (!Number.isInteger(maxRecentColors) || maxRecentColors < 0) throw new RangeError('CgColorPicker maxRecentColors must be a nonnegative integer.');
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const customInputRef = useRef<HTMLInputElement>(null);
  const resolvedDirection = useDirection(rootRef, direction);
  const baseId = useCgId();
  const [current, setCurrent] = useControllableState<CgColorPickerValue | null>(value, defaultValue, 'CgColorPicker');
  const [recents, setRecents] = useControllableState<ReadonlyArray<CgColorPickerValue>>(recentColors, defaultRecentColors, 'CgColorPicker recent colors');
  const text = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);

  const theme = useMemo(() => themeRows(themeColors ?? [], text), [text, themeColors]);
  const standard = useMemo(() => standardColors.map(({ name, color }): Swatch => {
    const normalized = normalizeHexColor(color, `CgColorPicker standard color '${name}'`);
    return { key: `standard:${normalized}`, value: { kind: 'rgb', color: normalized }, label: name, source: 'standard' };
  }), [standardColors]);
  const recent = useMemo(() => {
    const swatches: Swatch[] = [];
    for (const item of recents.slice(0, maxRecentColors)) {
      if (item.kind !== 'theme' && item.kind !== 'rgb') continue;
      const color = normalizeHexColor(item.color, 'CgColorPicker recent color');
      const named = item.kind === 'theme'
        ? themeColors?.find((entry) => entry.key === item.key)?.name
        : standard.find((entry) => entry.value.color === color)?.label;
      const label = item.kind === 'theme' && named ? shadeLabel(named, item.tint, text) : named ?? color;
      swatches.push({ key: `recent:${swatches.length}`, value: { ...item, color }, label, source: 'recent' });
    }
    return swatches;
  }, [maxRecentColors, recents, standard, text, themeColors]);

  const standardRows = useMemo(() => chunk(standard, PALETTE_COLUMNS), [standard]);
  const recentRows = useMemo(() => chunk(recent, PALETTE_COLUMNS), [recent]);
  const swatchRows = useMemo(() => [...theme, ...standardRows, ...recentRows], [recentRows, standardRows, theme]);
  const keyRows = useMemo(() => swatchRows.map((row) => row.map((swatch) => swatch?.key ?? null)), [swatchRows]);
  const selectedKey = swatchRows.flat().find((swatch) => swatch && sameColor(current, swatch.value))?.key;
  const { tabStopKey, register, handleKeyDown, setFocusedKey } = useRovingGrid(keyRows, selectedKey, resolvedDirection);

  const choose = useStableCallback((next: CgColorPickerValue, source: CgColorPickerSource, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement> | Event) => {
    if (disabled) return;
    setCurrent(next);
    onValueChange?.(next, { source, event });
    if (next.kind !== 'theme' && next.kind !== 'rgb') return;
    const updated = [next, ...recents.filter((item) => !sameColor(item, next))].slice(0, maxRecentColors);
    setRecents(updated);
    onRecentColorsChange?.(updated);
  });

  // The native change event fires when the browser's dialog closes, once per chosen color.
  useEffect(() => {
    const input = customInputRef.current;
    if (!input) return undefined;
    const commit = (event: Event) => choose({ kind: 'rgb', color: normalizeHexColor(input.value, 'CgColorPicker custom color') }, 'custom', event);
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  }, [allowCustomColor, choose]);
  const currentRgb = current?.kind === 'theme' || current?.kind === 'rgb' ? current.color : '#000000';
  useEffect(() => { if (customInputRef.current) customInputRef.current.value = currentRgb; }, [allowCustomColor, currentRgb]);

  const renderSwatch = (swatch: Swatch | null, index: number) => {
    if (!swatch) return <span key={index} role="gridcell" className={styles.gap} />;
    const selected = sameColor(current, swatch.value);
    return (
      <button
        key={swatch.key}
        ref={(element) => register(swatch.key, element)}
        type="button"
        role="gridcell"
        className={styles.swatch}
        style={{ '--cg-color-picker-swatch': swatch.value.color } as SwatchStyle}
        title={swatch.label}
        aria-label={swatch.label}
        aria-selected={selected}
        tabIndex={tabStopKey === swatch.key ? 0 : -1}
        disabled={disabled}
        data-cg-color-picker-swatch={swatch.key}
        data-color={swatch.value.color}
        data-cg-initial-focus={swatch.key === selectedKey ? '' : undefined}
        onFocus={() => setFocusedKey(swatch.key)}
        onKeyDown={(event) => handleKeyDown(event, swatch.key)}
        onClick={(event) => choose(swatch.value, swatch.source, event)}
      />
    );
  };

  const renderSection = (name: string, heading: string, rows: ReadonlyArray<ReadonlyArray<Swatch | null>>, gridClass?: string) => {
    if (rows.length === 0) return null;
    const headingId = `${baseId}-${name}`;
    return (
      <div className={styles.section} data-cg-color-picker-section={name}>
        <div id={headingId} className={styles.heading}>{heading}</div>
        <div role="grid" aria-labelledby={headingId} className={cx(styles.grid, gridClass)}>
          {rows.map((row, index) => <div key={index} role="row" className={styles.row}>{row.map(renderSwatch)}</div>)}
        </div>
      </div>
    );
  };

  const renderOption = (kind: 'automatic' | 'none', label: string, swatchClass: string, swatchStyle?: CSSProperties) => (
    <button
      type="button"
      className={styles.option}
      aria-pressed={current?.kind === kind}
      disabled={disabled}
      data-cg-color-picker-option={kind}
      onClick={(event) => choose({ kind }, kind, event)}
    ><span className={swatchClass} style={swatchStyle} aria-hidden="true" />{label}</button>
  );

  return (
    <div
      {...nativeProps}
      ref={mergedRef}
      role="group"
      aria-label={nativeAriaLabel ?? text.picker}
      dir={direction === 'auto' ? undefined : direction}
      className={cx(styles.root, className)}
      data-cg-color-picker=""
      data-disabled={disabled || undefined}
    >
      {allowAutomatic ? renderOption('automatic', text.automatic, styles.automaticSwatch!, automaticColor ? { background: automaticColor } : undefined) : null}
      {renderSection('theme', text.themeColors, theme, styles.themeGrid)}
      {renderSection('standard', text.standardColors, standardRows)}
      {renderSection('recent', text.recentColors, recentRows)}
      {allowNone ? renderOption('none', text.none, styles.noneSwatch!) : null}
      {allowCustomColor ? (
        <label className={styles.option} data-cg-color-picker-option="custom" data-disabled={disabled || undefined}>
          <span className={styles.customSwatch} aria-hidden="true" />
          {text.customColor}
          <input ref={customInputRef} type="color" className={styles.customInput} disabled={disabled} defaultValue={currentRgb} />
        </label>
      ) : null}
    </div>
  );
});
