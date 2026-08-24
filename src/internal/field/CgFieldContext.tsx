import { createContext, useContext } from 'react';
import type { CgValidationState } from '../../types';

export interface CgFieldContextValue {
  controlId: string;
  descriptionId?: string;
  messageId?: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  validationState: CgValidationState;
}

export const CgFieldContext = createContext<CgFieldContextValue | undefined>(undefined);

export function useCgFieldContext(): CgFieldContextValue | undefined {
  return useContext(CgFieldContext);
}

export function mergeAriaIds(...values: Array<string | undefined>): string | undefined {
  const ids = [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))];
  return ids.length > 0 ? ids.join(' ') : undefined;
}
