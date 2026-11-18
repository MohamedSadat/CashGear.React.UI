import type { CSSProperties, MouseEvent, ReactElement, ReactNode } from 'react';
import type { FluentIconName } from '../vendor/fluent-icons/icons';

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

export interface CgLookupErrorDetails<TValue = unknown, TContext = unknown> {
  readonly error: unknown;
  readonly searchText?: string;
  readonly value?: TValue;
  readonly queryContext?: TContext;
}

export type CgIconName =
  | FluentIconName
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
  | 'chevron-end'
  | 'sidebar'
  | 'zoom-out'
  | 'zoom-in'
  | 'rotate'
  | 'print'
  | 'download'
  | 'fullscreen';

export type CgIconSource = CgIconName | ReactElement;

export interface CgBaseProps {
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export interface CgEditorButtonContext<TValue> {
  value: TValue;
  /** The click; its target is an anchor for a descriptor with `href`. */
  event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>;
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
  /** Renders a link instead of a button. A disabled link has no `href`. Blazor `NavigateUrl`. */
  href?: string;
  /** Link target, such as `_blank`. Used with `href`. */
  target?: string;
  /** `false` leaves the button out of the Tab order; it still works with the pointer. Defaults to true. */
  focusable?: boolean;
  /** Native button type, for a button inside a form. Defaults to `button`. */
  type?: 'button' | 'submit' | 'reset';
  /** Extra class names on the button or link. */
  className?: string;
  onPress?: (context: CgEditorButtonContext<TValue>) => void | PromiseLike<void>;
}
