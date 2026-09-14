import { forwardRef, useRef } from 'react';
import { useControllableState, useDirection, useFormReset, useMergedRefs } from '../../hooks';
import { useFieldControl } from '../../internal';
import { todayCivilDate, toCanonicalDate, parseCanonicalDate } from '../../internal/date/dateMath';
import { dateRangePresetKeys, resolveDateRangePreset } from '../../internal/date/dateRangePresets';
import { cx } from '../../utils';
import type { CgDateRangePresetKey, CgDateRangePresetSelectProps, CgDateRangePresetSelection } from './CgDateRangePresetSelect.types';
import styles from './CgDateRangePresetSelect.module.css';

const english: Record<CgDateRangePresetKey, string> = { last30Days: 'Last 30 days', currentMonth: 'Current month', lastMonth: 'Last month', yearToDate: 'Year to date', lastYear: 'Last year', last2Years: 'Last 2 years', custom: 'Custom' };
const arabic: Record<CgDateRangePresetKey, string> = { last30Days: 'آخر ٣٠ يومًا', currentMonth: 'الشهر الحالي', lastMonth: 'الشهر الماضي', yearToDate: 'من بداية السنة', lastYear: 'السنة الماضية', last2Years: 'السنتان الماضيتان', custom: 'مخصص' };

export const CgDateRangePresetSelect = forwardRef<HTMLSelectElement, CgDateRangePresetSelectProps>(function CgDateRangePresetSelect({ value, defaultValue = 'last30Days', onValueChange, onSelectionChange, presets, presetText, anchorDate, minDate, maxDate, locale, readOnly, direction = 'auto', size = 'medium', validationState, id, required, disabled, name, form, className, style, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, ...nativeProps }, forwardedRef) {
  const [selected, setSelected] = useControllableState(value, defaultValue, 'CgDateRangePresetSelect');
  const ref = useRef<HTMLSelectElement>(null); const merged = useMergedRefs(ref, forwardedRef);
  const dir = useDirection(ref, direction); const isArabic = /^ar(?:-|$)/i.test(locale ?? '');
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy, labelledBy, ariaLabel });
  const anchor = anchorDate ?? toCanonicalDate(todayCivilDate());
  for (const [label, date] of Object.entries({ anchorDate: anchor, minDate, maxDate })) if (date !== undefined && !parseCanonicalDate(date)) throw new Error(`${label} must be a canonical YYYY-MM-DD date.`);
  if (minDate && maxDate && minDate > maxDate) throw new Error('minDate must not exceed maxDate.');
  if (!dateRangePresetKeys.includes(selected)) throw new Error('Unknown selected date range preset.');
  const offered = [...new Set(presets?.filter(preset => dateRangePresetKeys.includes(preset)) ?? [])];
  if (!offered.length) offered.push(...dateRangePresetKeys);
  if (!offered.includes(selected)) offered.unshift(selected);
  const resolve = (preset: CgDateRangePresetKey): { selection: CgDateRangePresetSelection; unavailable: boolean } => {
    let range;
    try { range = resolveDateRangePreset(preset, anchor); }
    catch (error) { if (!(error instanceof RangeError)) throw error; return { selection: { preset, range: null, isClamped: false }, unavailable: true }; }
    const unavailable = !!range && (!!minDate && range.end! < minDate || !!maxDate && range.end! > maxDate);
    const isClamped = !!range && !unavailable && !!minDate && range.start! < minDate;
    return { selection: Object.freeze({ preset, range: isClamped && range && minDate ? Object.freeze({ start: minDate, end: range.end }) : range, isClamped }), unavailable };
  };
  useFormReset(ref, () => { setSelected(defaultValue); if (ref.current) ref.current.value = value ?? defaultValue; });
  return <>
    <select {...nativeProps} ref={merged} id={field.id} value={selected} name={field.readOnly ? undefined : name} form={form} required={field.required} disabled={field.disabled || field.readOnly} dir={dir} className={cx(styles.select, className)} style={style} data-size={size} aria-label={field.ariaLabel ?? (field.labelledBy ? undefined : isArabic ? 'النطاق الزمني' : 'Date range')} aria-labelledby={field.labelledBy} aria-describedby={field.describedBy} aria-errormessage={field.errorMessageId} aria-invalid={field.validationState === 'error' || undefined} onChange={event => {
      const preset = event.currentTarget.value as CgDateRangePresetKey;
      if (field.disabled || field.readOnly || !offered.includes(preset)) return;
      const next = resolve(preset); if (next.unavailable) return;
      setSelected(preset); onValueChange?.(preset); onSelectionChange?.(next.selection, event);
    }}>
      {offered.map(preset => <option key={preset} value={preset} disabled={resolve(preset).unavailable}>{presetText?.(preset)?.trim() || (isArabic ? arabic : english)[preset]}</option>)}
    </select>
    {field.readOnly && name ? <input type="hidden" name={name} form={form} value={selected} disabled={field.disabled} /> : null}
  </>;
});
