import type { ReactNode } from 'react';
import type { CgBaseProps, CgValidationState } from '../../types';

export interface CgFieldProps extends CgBaseProps {
  children: ReactNode;
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  validationState?: CgValidationState;
  validationMessage?: ReactNode;
  errorMessage?: ReactNode;
  controlId?: string;
}
