/* eslint-disable @typescript-eslint/no-base-to-string -- explicit editor metadata controls string conversion. */
import type { ReactNode } from 'react';
import { CgCheckBox } from '../CheckBox';
import { CgComboBox } from '../ComboBox';
import { CgTextBox } from '../TextBox';
import type { CgGridColumnDescriptor, CgGridEditorMetadata } from './CgGrid.types';
import styles from './CgGrid.module.css';

function dateValue(value: unknown): string | null { if (!value) return null; const date = value instanceof Date ? value : new Date(String(value)); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10); }

export interface GridRawDraft { readonly value: string; readonly invalid: boolean; readonly message?: string }
export type GridRawDrafts = Readonly<Record<string, GridRawDraft>>;

export function renderAutomaticGridEditor<TItem>(column: CgGridColumnDescriptor<TItem>, model: TItem, setModel: (model: TItem) => void, fieldErrors: Readonly<Record<string, ReadonlyArray<string>>>, options?: { readonly idPrefix?: string; readonly showLabel?: boolean; readonly rawDrafts?: GridRawDrafts; readonly onRawDraft?: (fieldId: string, draft: GridRawDraft) => void; readonly disabled?: boolean }): ReactNode {
  const metadata = column.editor as CgGridEditorMetadata<TItem, unknown> | undefined;
  if (!metadata || !column.accessor) return null;
  const value = column.accessor(model); const error = fieldErrors[column.fieldId]?.[0]; const set = (next: unknown) => setModel(metadata.setValue(model, next));
  const context = { model, value, setValue: set, error, disabled: options?.disabled || metadata.disabled || false, readOnly: metadata.readOnly ?? false };
  if (metadata.render) return metadata.render(context);
  const identity = `${options?.idPrefix ?? 'cg-grid-editor'}-${column.fieldId}`;
  const common = { disabled: options?.disabled || metadata.disabled, readOnly: metadata.readOnly, required: metadata.required, fullWidth: true, placeholder: metadata.placeholder, validationState: error ? 'error' as const : undefined, 'aria-describedby': error ? `${identity}-error` : metadata.memo ? `${identity}-memo` : undefined };
  const raw = options?.rawDrafts?.[column.fieldId];
  let editor: ReactNode;
  switch (metadata.kind) {
    case 'number': editor = <input type="text" inputMode="decimal" value={raw?.value ?? (typeof value === 'number' ? String(value) : '')} disabled={common.disabled} readOnly={common.readOnly} required={common.required} aria-describedby={common['aria-describedby']} aria-invalid={Boolean(error || raw?.invalid) || undefined} onChange={(event) => { const draft = event.currentTarget.value; const parsed = draft.trim() === '' ? null : Number(draft.trim().replace(',', '.')); const invalid = parsed !== null && !Number.isFinite(parsed); options?.onRawDraft?.(column.fieldId, { value: draft, invalid, ...(invalid ? { message: 'Enter a valid finite number.' } : {}) }); if (!invalid) set(parsed); }} />; break;
    case 'date': editor = <input type="text" inputMode="numeric" placeholder={metadata.placeholder ?? 'YYYY-MM-DD'} value={raw?.value ?? dateValue(value) ?? ''} disabled={common.disabled} readOnly={common.readOnly} required={common.required} aria-describedby={common['aria-describedby']} aria-invalid={Boolean(error || raw?.invalid) || undefined} onChange={(event) => { const draft = event.currentTarget.value; const parsed = /^\d{4}-\d{2}-\d{2}$/u.test(draft) && dateValue(draft) === draft ? draft : null; const invalid = draft.trim() !== '' && parsed === null; options?.onRawDraft?.(column.fieldId, { value: draft, invalid, ...(invalid ? { message: 'Enter a valid date.' } : {}) }); if (!invalid) set(parsed); }} />; break;
    case 'dateTime': editor = <CgTextBox {...common} type="text" value={raw?.value ?? (value == null ? '' : String(value))} onChange={(event) => { const draft = event.currentTarget.value; const invalid = draft.trim() !== '' && !Number.isFinite(Date.parse(draft)); options?.onRawDraft?.(column.fieldId, { value: draft, invalid, ...(invalid ? { message: 'Enter a valid date and time.' } : {}) }); }} onValueChange={(next) => { if (!next.trim() || Number.isFinite(Date.parse(next))) set(next); }} />; break;
    case 'boolean': editor = <CgCheckBox disabled={options?.disabled || metadata.disabled} readOnly={metadata.readOnly} required={metadata.required} checked={Boolean(value)} onCheckedChange={(checked) => set(checked === true)} />; break;
    case 'enum':
    case 'lookup': {
      const editorOptions = metadata.options ?? []; const selected = editorOptions.find((option) => Object.is(option.value, value)) ?? null;
      editor = <CgComboBox options={editorOptions.filter((option) => !option.disabled)} value={selected} disabled={options?.disabled || metadata.disabled} readOnly={metadata.readOnly} required={metadata.required} validationState={error || raw?.invalid ? 'error' : undefined} fullWidth getOptionKey={(option) => option.key} getOptionLabel={(option) => option.label} onChange={(event) => options?.onRawDraft?.(column.fieldId, { value: event.currentTarget.value, invalid: true, message: 'Select a valid option.' })} onValueChange={(option) => { options?.onRawDraft?.(column.fieldId, { value: option?.label ?? '', invalid: false }); set(option?.value ?? null); }} />; break;
    }
    default: editor = <CgTextBox {...common} value={value == null ? '' : String(value)} minLength={metadata.minimumLength} maxLength={metadata.maximumLength} onValueChange={set} />; break;
  }
  return <label data-cg-grid-editor-field={column.fieldId} style={{ display: 'grid', gap: '0.25rem' }}>{options?.showLabel === false ? <span className={styles.visuallyHidden}>{metadata.label ?? column.title ?? column.fieldId}</span> : <span>{metadata.label ?? column.title ?? column.fieldId}{metadata.required ? ' *' : ''}</span>}{editor}{metadata.memo ? <small id={`${identity}-memo`}>{metadata.memo}</small> : null}{error ? <span id={`${identity}-error`} role="alert">{error}</span> : null}</label>;
}

export function validateAutomaticGridEditors<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, model: TItem, rawDrafts: GridRawDrafts = {}): Readonly<Record<string, ReadonlyArray<string>>> {
  const errors: Record<string, ReadonlyArray<string>> = {};
  for (const column of columns) {
    const metadata = column.editor; if (!metadata || !column.accessor || metadata.disabled || metadata.readOnly) continue;
    const value = column.accessor(model); const text = value == null ? '' : String(value); const field: string[] = [];
    const raw = rawDrafts[column.fieldId];
    if (raw?.invalid) field.push(raw.message ?? 'Enter a valid value.');
    if (metadata.required && (value === null || value === undefined || text.trim() === '')) field.push(`${metadata.label ?? column.title ?? column.fieldId} is required.`);
    if (metadata.minimumLength !== undefined && text.length > 0 && text.length < metadata.minimumLength) field.push(`Enter at least ${metadata.minimumLength} characters.`);
    if (metadata.maximumLength !== undefined && text.length > metadata.maximumLength) field.push(`Enter no more than ${metadata.maximumLength} characters.`);
    if (typeof value === 'number' && !Number.isFinite(value)) field.push('Enter a valid finite number.');
    if (typeof value === 'number' && typeof metadata.minimum === 'number' && value < metadata.minimum) field.push(`Value must be at least ${metadata.minimum}.`);
    if (typeof value === 'number' && typeof metadata.maximum === 'number' && value > metadata.maximum) field.push(`Value must be no more than ${metadata.maximum}.`);
    if ((metadata.kind === 'date' || metadata.kind === 'dateTime') && value != null && text.trim() !== '') {
      const time = value instanceof Date ? value.getTime() : Date.parse(text);
      if (!Number.isFinite(time)) field.push('Enter a valid date.');
      const minimum = metadata.minimum instanceof Date ? metadata.minimum.getTime() : typeof metadata.minimum === 'number' ? metadata.minimum : undefined;
      const maximum = metadata.maximum instanceof Date ? metadata.maximum.getTime() : typeof metadata.maximum === 'number' ? metadata.maximum : undefined;
      if (minimum !== undefined && time < minimum) field.push(`Date must be on or after ${new Date(minimum).toISOString()}.`);
      if (maximum !== undefined && time > maximum) field.push(`Date must be on or before ${new Date(maximum).toISOString()}.`);
    }
    if ((metadata.kind === 'enum' || metadata.kind === 'lookup') && value != null && !metadata.options?.some((option) => !option.disabled && Object.is(option.value, value))) field.push('Select a valid option.');
    if (field.length) errors[column.fieldId] = field;
  }
  return errors;
}
