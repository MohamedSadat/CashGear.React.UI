import type { CSSProperties } from 'react';
import { DEFAULT_GRID_TABLE_APPEARANCE, normalizeGridTableAppearance } from './state';
import type { CgGridTableAppearance, CgGridTableColor, CgGridTableIntensity, CgGridTableStyleLabels } from './CgGrid.types';
import styles from './TableStylePicker.module.css';

export const DEFAULT_GRID_TABLE_STYLE_LABELS: CgGridTableStyleLabels = {
  title: 'Table Style', options: 'Formatting options', color: 'Color', intensity: 'Intensity', banding: 'Banding', borders: 'Borders', density: 'Row spacing',
  coloredHeader: 'Theme-colored header', emphasizeFirstColumn: 'Emphasize first data column', emphasizeLastColumn: 'Emphasize last data column', emphasizeTotals: 'Emphasize total row',
  reset: 'Reset appearance', close: 'Close table style', savedViewHint: 'Use Save View to keep this appearance with your columns and filters.', temporaryHint: 'Appearance changes apply to this grid for the current session.',
  blue: 'Blue', green: 'Green', teal: 'Teal', gray: 'Gray', orange: 'Orange', purple: 'Purple', light: 'Light', medium: 'Medium', dark: 'Dark',
  none: 'None', rows: 'Alternating rows', columns: 'Alternating columns', horizontal: 'Horizontal lines', all: 'Complete cell grid', compact: 'Compact', normal: 'Normal', comfortable: 'Comfortable', presets: 'Table styles',
};

export const GRID_TABLE_PALETTES: Record<CgGridTableColor, { readonly accent: string; readonly deep: string }> = {
  blue: { accent: '#1d4ed8', deep: '#172554' }, green: { accent: '#166534', deep: '#052e16' }, teal: { accent: '#0f766e', deep: '#042f2e' },
  gray: { accent: '#475569', deep: '#1e293b' }, orange: { accent: '#9a3412', deep: '#431407' }, purple: { accent: '#7e22ce', deep: '#3b0764' },
};

const COLORS = Object.keys(GRID_TABLE_PALETTES) as CgGridTableColor[];
const INTENSITIES: CgGridTableIntensity[] = ['light', 'medium', 'dark'];

interface TableStylePickerProps {
  readonly value: CgGridTableAppearance | null;
  readonly labels: CgGridTableStyleLabels;
  readonly persistable: boolean;
  readonly onChange: (appearance: CgGridTableAppearance) => void;
  readonly onReset: () => void;
}

export function TableStylePicker({ value, labels, persistable, onChange, onReset }: TableStylePickerProps) {
  const current = value ?? DEFAULT_GRID_TABLE_APPEARANCE;
  const update = (patch: Partial<CgGridTableAppearance>) => onChange(normalizeGridTableAppearance({ ...current, ...patch })!);
  return <div className={styles.root} data-cg-grid-table-style-picker>
    <fieldset><legend>{labels.presets}</legend><div className={styles.gallery}>
      {COLORS.flatMap((color) => INTENSITIES.map((intensity) => {
        const palette = GRID_TABLE_PALETTES[color];
        const previewStyle = { '--cg-table-accent': palette.accent, '--cg-table-deep': palette.deep } as CSSProperties;
        return <button key={`${color}-${intensity}`} type="button" className={styles.preset} aria-label={`${labels[color]} ${labels[intensity]}`} aria-pressed={value?.color === color && value?.intensity === intensity} onClick={() => update({ color, intensity })}>
          <span className={styles.preview} data-intensity={intensity} style={previewStyle} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</span>
          <span>{labels[color]} {labels[intensity]}</span>
        </button>;
      }))}
    </div></fieldset>
    <fieldset className={styles.options}><legend>{labels.options}</legend>
      <label>{labels.banding}<select aria-label={labels.banding} value={current.banding} onChange={(event) => update({ banding: event.currentTarget.value as CgGridTableAppearance['banding'] })}><option value="none">{labels.none}</option><option value="rows">{labels.rows}</option><option value="columns">{labels.columns}</option></select></label>
      <label>{labels.borders}<select aria-label={labels.borders} value={current.borders} onChange={(event) => update({ borders: event.currentTarget.value as CgGridTableAppearance['borders'] })}><option value="none">{labels.none}</option><option value="horizontal">{labels.horizontal}</option><option value="all">{labels.all}</option></select></label>
      <label>{labels.density}<select aria-label={labels.density} value={current.density} onChange={(event) => update({ density: event.currentTarget.value as CgGridTableAppearance['density'] })}><option value="compact">{labels.compact}</option><option value="normal">{labels.normal}</option><option value="comfortable">{labels.comfortable}</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={current.coloredHeader} onChange={(event) => update({ coloredHeader: event.currentTarget.checked })} />{labels.coloredHeader}</label>
      <label className={styles.check}><input type="checkbox" checked={current.emphasizeFirstColumn} onChange={(event) => update({ emphasizeFirstColumn: event.currentTarget.checked })} />{labels.emphasizeFirstColumn}</label>
      <label className={styles.check}><input type="checkbox" checked={current.emphasizeLastColumn} onChange={(event) => update({ emphasizeLastColumn: event.currentTarget.checked })} />{labels.emphasizeLastColumn}</label>
      <label className={styles.check}><input type="checkbox" checked={current.emphasizeTotals} onChange={(event) => update({ emphasizeTotals: event.currentTarget.checked })} />{labels.emphasizeTotals}</label>
    </fieldset>
    <p>{persistable ? labels.savedViewHint : labels.temporaryHint}</p>
    <button type="button" className={styles.reset} onClick={onReset}>{labels.reset}</button>
  </div>;
}
