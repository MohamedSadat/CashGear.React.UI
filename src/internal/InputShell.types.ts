import type { HTMLAttributes, ReactNode } from 'react';
import type { CgSizeMode, CgValidationState } from '../types';

export interface InputShellProps extends HTMLAttributes<HTMLDivElement> {
  start?: ReactNode;
  end?: ReactNode;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  disabled?: boolean;
  readOnly?: boolean;
}
