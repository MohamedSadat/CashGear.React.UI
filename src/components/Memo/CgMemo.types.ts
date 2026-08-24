import type { ChangeEvent, ReactNode, TextareaHTMLAttributes } from 'react';
import type { CgBaseProps, CgClearButtonDisplayMode, CgEditorButtonDescriptor, CgSizeMode, CgTextCommitMode, CgValidationState } from '../../types';

type NativeMemoProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'onChange'>;
export type CgMemoResizeMode = 'auto' | 'fixed' | 'manual';
export type CgMemoChangeReason = 'input' | 'blur' | 'debounce' | 'clear' | 'reset';
export interface CgMemoValueChange { reason: CgMemoChangeReason; event?: ChangeEvent<HTMLTextAreaElement>; }

export interface CgMemoProps extends NativeMemoProps, CgBaseProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: CgMemoValueChange) => void;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  commitMode?: CgTextCommitMode;
  debounceMs?: number;
  rows?: number;
  maxRows?: number;
  resizeMode?: CgMemoResizeMode;
  showCounter?: boolean;
  counterFormatter?: (length: number, maxLength?: number) => ReactNode;
  clearButton?: CgClearButtonDisplayMode;
  buttons?: ReadonlyArray<CgEditorButtonDescriptor<string>>;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  fullWidth?: boolean;
}
