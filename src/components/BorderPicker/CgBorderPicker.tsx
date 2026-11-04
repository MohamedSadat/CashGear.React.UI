import { forwardRef, useMemo, useRef } from 'react';
import { useControllableState, useDirection, useMergedRefs } from '../../hooks';
import { useRovingGrid } from '../../internal/rovingGrid';
import type { CgIconName } from '../../types';
import { cx } from '../../utils';
import { CgColorPicker } from '../ColorPicker';
import type { CgColorPickerValue } from '../ColorPicker';
import { CgDropDownButton } from '../DropDownButton';
import { CgIcon } from '../Icon';
import styles from './CgBorderPicker.module.css';
import type { CgBorderEdge, CgBorderLineStyle, CgBorderPickerProps, CgBorderPresetKey } from './CgBorderPicker.types';

interface PresetDefinition {
  readonly icon: CgIconName;
  readonly text: string;
  readonly edges: ReadonlyArray<CgBorderEdge | readonly [CgBorderEdge, CgBorderLineStyle]>;
}

const OUTSIDE: ReadonlyArray<CgBorderEdge> = ['top', 'bottom', 'left', 'right'];
const INSIDE: ReadonlyArray<CgBorderEdge> = ['inside-horizontal', 'inside-vertical'];

const PRESETS: Readonly<Record<CgBorderPresetKey, PresetDefinition>> = {
  none: { icon: 'border-none', text: 'No border', edges: [] },
  all: { icon: 'border-all', text: 'All borders', edges: [...OUTSIDE, ...INSIDE] },
  outside: { icon: 'border-outside', text: 'Outside borders', edges: OUTSIDE },
  inside: { icon: 'border-inside', text: 'Inside borders', edges: INSIDE },
  'inside-horizontal': { icon: 'border-inside-horizontal', text: 'Inside horizontal border', edges: ['inside-horizontal'] },
  'inside-vertical': { icon: 'border-inside-vertical', text: 'Inside vertical border', edges: ['inside-vertical'] },
  top: { icon: 'border-top', text: 'Top border', edges: ['top'] },
  bottom: { icon: 'border-bottom', text: 'Bottom border', edges: ['bottom'] },
  left: { icon: 'border-left', text: 'Left border', edges: ['left'] },
  right: { icon: 'border-right', text: 'Right border', edges: ['right'] },
  'left-right': { icon: 'border-left-right', text: 'Left and right borders', edges: ['left', 'right'] },
  'top-bottom': { icon: 'border-top-bottom', text: 'Top and bottom borders', edges: ['top', 'bottom'] },
  'outside-thick': { icon: 'border-outside-thick', text: 'Thick outside borders', edges: OUTSIDE.map((edge) => [edge, 'thick'] as const) },
  'bottom-thick': { icon: 'border-bottom-thick', text: 'Thick bottom border', edges: [['bottom', 'thick']] },
  'bottom-double': { icon: 'border-bottom-double', text: 'Double bottom border', edges: [['bottom', 'double']] },
  'top-bottom-thick': { icon: 'border-top-bottom-thick', text: 'Top and thick bottom borders', edges: ['top', ['bottom', 'thick']] },
  'top-bottom-double': { icon: 'border-top-bottom-double', text: 'Top and double bottom borders', edges: ['top', ['bottom', 'double']] },
};

const ALL_PRESETS = Object.keys(PRESETS) as ReadonlyArray<CgBorderPresetKey>;
const ALL_LINE_STYLES: ReadonlyArray<CgBorderLineStyle> = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double'];
const LINE_STYLE_NAMES: Readonly<Record<CgBorderLineStyle, string>> = { thin: 'Thin', medium: 'Medium', thick: 'Thick', dashed: 'Dashed', dotted: 'Dotted', double: 'Double' };
const PRESET_COLUMNS = 6;
const LINE_STYLE_COLUMNS = 3;
const AUTOMATIC: CgColorPickerValue = { kind: 'automatic' };

const LINE_SAMPLES: Readonly<Record<CgBorderLineStyle, { y: readonly number[]; width: number; dash?: string }>> = {
  thin: { y: [6], width: 1 },
  medium: { y: [6], width: 2 },
  thick: { y: [6], width: 3.5 },
  dashed: { y: [6], width: 1, dash: '4 3' },
  dotted: { y: [6], width: 1, dash: '1 2' },
  double: { y: [4.5, 7.5], width: 1 },
};

function chunk<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

export const CgBorderPicker = forwardRef<HTMLDivElement, CgBorderPickerProps>(function CgBorderPicker(
  { onApply, presets = ALL_PRESETS, activePreset, lineStyle, defaultLineStyle = 'thin', onLineStyleChange, lineStyles = ALL_LINE_STYLES, color, defaultColor = AUTOMATIC, onColorChange, colorPicker, disabled = false, direction = 'auto', labels, className, 'aria-label': nativeAriaLabel, ...nativeProps },
  forwardedRef,
) {
  const seen = new Set<string>();
  for (const key of presets) {
    if (!Object.hasOwn(PRESETS, key)) throw new Error(`CgBorderPicker doesn't know preset '${key}'.`);
    if (seen.has(key)) throw new Error(`CgBorderPicker contains duplicate preset '${key}'.`);
    seen.add(key);
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const [currentLineStyle, setLineStyle] = useControllableState<CgBorderLineStyle>(lineStyle, defaultLineStyle, 'CgBorderPicker line style');
  const [currentColor, setColor] = useControllableState<CgColorPickerValue>(color, defaultColor, 'CgBorderPicker color');

  const presetRows = useMemo(() => chunk(presets, PRESET_COLUMNS), [presets]);
  const lineRows = useMemo(() => chunk(lineStyles, LINE_STYLE_COLUMNS), [lineStyles]);
  const presetKeyRows = useMemo(() => (disabled ? [] : presetRows), [disabled, presetRows]);
  const lineKeyRows = useMemo(() => (disabled ? [] : lineRows), [disabled, lineRows]);
  const presetGrid = useRovingGrid(presetKeyRows, activePreset ?? undefined, resolvedDirection);
  const lineGrid = useRovingGrid(lineKeyRows, currentLineStyle, resolvedDirection);

  const text = { picker: 'Border picker', presets: 'Borders', lineStyle: 'Line style', lineColor: 'Line color', ...labels };
  const presetName = (key: CgBorderPresetKey) => text.presetNames?.[key] ?? PRESETS[key].text;
  const lineStyleName = (key: CgBorderLineStyle) => text.lineStyleNames?.[key] ?? LINE_STYLE_NAMES[key];
  const accent = currentColor.kind === 'none' ? 'transparent' : currentColor.kind === 'automatic' ? 'currentColor' : currentColor.color;

  const chooseLineStyle = (key: CgBorderLineStyle) => {
    if (disabled || key === currentLineStyle) return;
    setLineStyle(key);
    onLineStyleChange?.(key);
  };

  return (
    <div
      {...nativeProps}
      ref={mergedRef}
      role="group"
      aria-label={nativeAriaLabel ?? text.picker}
      dir={direction === 'auto' ? undefined : direction}
      className={cx(styles.root, className)}
      data-cg-border-picker=""
      data-disabled={disabled || undefined}
    >
      <div role="grid" aria-label={text.presets} className={styles.grid}>
        {presetRows.map((row, index) => (
          <div key={index} role="row" className={styles.row}>
            {row.map((key) => (
              <button
                key={key}
                ref={(element) => presetGrid.register(key, element)}
                type="button"
                role="gridcell"
                className={styles.preset}
                title={presetName(key)}
                aria-label={presetName(key)}
                aria-selected={activePreset === key}
                tabIndex={presetGrid.tabStopKey === key ? 0 : -1}
                disabled={disabled}
                data-cg-border-preset={key}
                data-cg-initial-focus={activePreset === key ? '' : undefined}
                onFocus={() => presetGrid.setFocusedKey(key)}
                onKeyDown={(event) => presetGrid.handleKeyDown(event, key)}
                onClick={(event) => {
                  const edges = PRESETS[key].edges.map((entry) => (typeof entry === 'string' ? { edge: entry, lineStyle: currentLineStyle } : { edge: entry[0], lineStyle: entry[1] }));
                  onApply?.({ preset: key, edges, clear: key === 'none', color: currentColor, event });
                }}
              ><CgIcon name={PRESETS[key].icon} size={20} /></button>
            ))}
          </div>
        ))}
      </div>
      {lineStyles.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.heading} aria-hidden="true">{text.lineStyle}</div>
          <div role="radiogroup" aria-label={text.lineStyle} className={styles.grid}>
            {lineRows.map((row, index) => (
              <div key={index} className={styles.row}>
                {row.map((key) => {
                  const sample = LINE_SAMPLES[key];
                  return (
                    <button
                      key={key}
                      ref={(element) => lineGrid.register(key, element)}
                      type="button"
                      role="radio"
                      className={styles.lineStyle}
                      title={lineStyleName(key)}
                      aria-label={lineStyleName(key)}
                      aria-checked={currentLineStyle === key}
                      tabIndex={lineGrid.tabStopKey === key ? 0 : -1}
                      disabled={disabled}
                      data-cg-border-line-style={key}
                      onFocus={() => { lineGrid.setFocusedKey(key); chooseLineStyle(key); }}
                      onKeyDown={(event) => lineGrid.handleKeyDown(event, key)}
                      onClick={() => chooseLineStyle(key)}
                    >
                      <svg viewBox="0 0 40 12" width="40" height="12" aria-hidden="true" focusable="false">
                        {sample.y.map((y) => <line key={y} x1="2" x2="38" y1={y} y2={y} stroke="currentColor" strokeWidth={sample.width} strokeDasharray={sample.dash} />)}
                      </svg>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <CgDropDownButton
        appearance="ghost"
        size="small"
        icon={<CgIcon name="line-color" size={20} accentColor={accent} />}
        disabled={disabled}
        direction={resolvedDirection}
        placement="right-start"
        menuAriaLabel={text.lineColor}
        menuMaxHeight="none"
        menuMaxWidth="none"
        data-cg-border-line-color=""
        renderFlyout={({ close }) => (
          <CgColorPicker
            allowAutomatic
            {...colorPicker}
            value={currentColor}
            direction={resolvedDirection}
            onValueChange={(next) => {
              setColor(next);
              onColorChange?.(next);
              close();
            }}
          />
        )}
      >{text.lineColor}</CgDropDownButton>
    </div>
  );
});
