import type { CSSProperties, MouseEvent, ReactElement, ReactNode } from 'react';

export type CgSizeMode = 'small' | 'medium' | 'large';
/** @deprecated Use CgSizeMode. */
export type CgSize = CgSizeMode;
export type CgDensity = 'compact' | 'comfortable';
export type CgIntent =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'link';
export type CgOrientation = 'horizontal' | 'vertical';
export type CgDirection = 'auto' | 'ltr' | 'rtl';
export type CgValidationState = 'none' | 'error' | 'warning' | 'success';
export type CgEditorPlacement = 'start' | 'end';
export type CgClearButtonDisplayMode = 'never' | 'auto' | 'always';
export type CgTextCommitMode = 'input' | 'blur' | 'debounced';

export type CgIconName =
  | 'search'
  | 'clear'
  | 'close'
  | 'eye'
  | 'eye-off'
  | 'check'
  | 'minus'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-start'
  | 'chevron-end';

export type CgIconSource = CgIconName | ReactElement;

export interface CgBaseProps {
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export interface CgEditorButtonContext<TValue> {
  value: TValue;
  event: MouseEvent<HTMLButtonElement>;
}

export interface CgEditorButtonDescriptor<TValue = string> {
  key: string;
  placement?: CgEditorPlacement;
  icon?: CgIconSource;
  text?: ReactNode;
  ariaLabel: string;
  title?: string;
  disabled?: boolean;
  visible?: boolean;
  preventFocusLoss?: boolean;
  preventDuplicateClicks?: boolean;
  onPress?: (context: CgEditorButtonContext<TValue>) => void | Promise<void>;
}
