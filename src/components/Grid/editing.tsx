/* eslint-disable @typescript-eslint/no-base-to-string -- explicit editor metadata controls string conversion. */
import type { ReactNode } from 'react';
import { CgCheckBox } from '../CheckBox';
import { CgComboBox } from '../ComboBox';
import { CgDateEdit } from '../DateEdit';
import { CgNumericEdit } from '../NumericEdit';
import { CgTextBox } from '../TextBox';
import type { CgGridColumnDescriptor, CgGridEditorMetadata } from './CgGrid.types';

function dateValue(value: unknown): string | null { if (!value) return null; const date = value instanceof Date ? value : new Date(String(value)); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10); }

export function renderAutomaticGridEditor<TItem>(column: CgGridColumnDescriptor<TItem>, model: TItem, setModel: (model: TItem) => void, fieldErrors: Readonly<Record<string, ReadonlyArray<string>>>): ReactNode {
  const metadata = column.editor as CgGridEditorMetadata<TItem, unknown> | undefined;
  if (!metadata || !column.accessor) return null;
  const value = column.accessor(model); const error = fieldErrors[column.fieldId]?.[0]; const set = (next: unknown) => setModel(metadata.setValue(model, next));
  const context = { model, value, setValue: set, error, disabled: metadata.disabled ?? false, readOnly: metadata.readOnly ?? false };
  if (metadata.render) return metadata.render(context);
  const common = { disabled: metadata.disabled, readOnly: metadata.readOnly, required: metadata.required, fullWidth: true, placeholder: metadata.placeholder, validationState: error ? 'error' as const : undefined, 'aria-describedby': error ? `cg-grid-editor-error-${column.fieldId}` : undefined };
  let editor: ReactNode;
  switch (metadata.kind) {
    case 'number': editor = <CgNumericEdit {...common} value={typeof value === 'number' ? value : null} min={metadata.minimum instanceof Date ? undefined : metadata.minimum} max={metadata.maximum instanceof Date ? undefined : metadata.maximum} step={metadata.step} onValueChange={set} />; break;
    case 'date': editor = <CgDateEdit {...common} value={dateValue(value)} minDate={metadata.minimum instanceof Date ? dateValue(metadata.minimum) ?? undefined : undefined} maxDate={metadata.maximum instanceof Date ? dateValue(metadata.maximum) ?? undefined : undefined} onValueChange={set} />; break;
    case 'dateTime': editor = <CgTextBox {...common} type="text" value={value == null ? '' : String(value)} onValueChange={set} />; break;
    case 'boolean': editor = <CgCheckBox disabled={metadata.disabled} readOnly={metadata.readOnly} required={metadata.required} checked={Boolean(value)} onCheckedChange={(checked) => set(checked === true)} />; break;
    case 'enum':
    case 'lookup': {
      const options = metadata.options ?? []; const selected = options.find((option) => Object.is(option.value, value)) ?? null;
      editor = <CgComboBox options={options} value={selected} disabled={metadata.disabled} readOnly={metadata.readOnly} required={metadata.required} fullWidth getOptionKey={(option) => option.key} getOptionLabel={(option) => option.label} onValueChange={(option) => set(option?.value ?? null)} />; break;
    }
    default: editor = <CgTextBox {...common} value={value == null ? '' : String(value)} minLength={metadata.minimumLength} maxLength={metadata.maximumLength} onValueChange={set} />; break;
  }
  return <label style={{ display: 'grid', gap: '0.25rem' }}><span>{metadata.label ?? column.title ?? column.fieldId}{metadata.required ? ' *' : ''}</span>{editor}{error ? <span id={`cg-grid-editor-error-${column.fieldId}`} role="alert">{error}</span> : null}</label>;
}

export function validateAutomaticGridEditors<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, model: TItem): Readonly<Record<string, ReadonlyArray<string>>> {
  const errors: Record<string, ReadonlyArray<string>> = {};
  for (const column of columns) {
    const metadata = column.editor; if (!metadata || !column.accessor || metadata.disabled || metadata.readOnly) continue;
    const value = column.accessor(model); const text = value == null ? '' : String(value); const field: string[] = [];
    if (metadata.required && (value === null || value === undefined || text.trim() === '')) field.push(`${metadata.label ?? column.title ?? column.fieldId} is required.`);
    if (metadata.minimumLength !== undefined && text.length < metadata.minimumLength) field.push(`Enter at least ${metadata.minimumLength} characters.`);
    if (metadata.maximumLength !== undefined && text.length > metadata.maximumLength) field.push(`Enter no more than ${metadata.maximumLength} characters.`);
    if (typeof value === 'number' && typeof metadata.minimum === 'number' && value < metadata.minimum) field.push(`Value must be at least ${metadata.minimum}.`);
    if (typeof value === 'number' && typeof metadata.maximum === 'number' && value > metadata.maximum) field.push(`Value must be no more than ${metadata.maximum}.`);
    if (field.length) errors[column.fieldId] = field;
  }
  return errors;
}
