import { useCgId } from '../../hooks';
import type { CgValidationState } from '../../types';
import { mergeAriaIds, useCgFieldContext } from './CgFieldContext';

export interface FieldControlOptions {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  validationState?: CgValidationState;
  describedBy?: string;
}

export function useFieldControl(options: FieldControlOptions) {
  const field = useCgFieldContext();
  const id = useCgId(options.id ?? field?.controlId);
  const validationState =
    options.validationState && options.validationState !== 'none'
      ? options.validationState
      : (field?.validationState ?? 'none');
  return {
    id,
    required: Boolean(options.required || field?.required),
    disabled: Boolean(options.disabled || field?.disabled),
    readOnly: Boolean(options.readOnly || field?.readOnly),
    validationState,
    labelId: field?.labelId,
    describedBy: mergeAriaIds(options.describedBy, field?.descriptionId, field?.messageId),
    errorMessageId: validationState === 'error' ? field?.messageId : undefined,
  } as const;
}
