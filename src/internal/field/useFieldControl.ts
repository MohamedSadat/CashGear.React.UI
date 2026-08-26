import { useCgId } from '../../hooks';
import type { CgValidationState } from '../../types';
import { mergeAriaIds, useCgFieldContext } from './CgFieldContext';
import { useCgFormLayoutCaptionId } from './CgFormLayoutCaptionContext';

export interface FieldControlOptions {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  validationState?: CgValidationState;
  describedBy?: string;
  ariaLabel?: string;
  labelledBy?: string;
}

export function useFieldControl(options: FieldControlOptions) {
  const field = useCgFieldContext();
  const formLayoutCaptionId = useCgFormLayoutCaptionId();
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
    ariaLabel: options.ariaLabel,
    labelledBy: options.ariaLabel ? undefined : options.labelledBy ?? field?.labelId ?? formLayoutCaptionId,
    describedBy: mergeAriaIds(options.describedBy, field?.descriptionId, field?.messageId),
    errorMessageId: validationState === 'error' ? field?.messageId : undefined,
  } as const;
}
