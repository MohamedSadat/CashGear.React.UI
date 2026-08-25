import type {
  CSSProperties,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SyntheticEvent,
} from 'react';
import type {
  CgBaseProps,
  CgDensity,
  CgDirection,
  CgEditorButtonDescriptor,
  CgSizeMode,
  CgValidationState,
} from '../../types';

export type CgDropDownBoxCommitMode = 'immediate' | 'explicit';
export type CgDropDownBoxWidthMode = 'editor' | 'content' | 'contentOrEditor' | 'explicit';
export type CgDropDownBoxPlacement =
  | 'bottom-start' | 'bottom' | 'bottom-end'
  | 'top-start' | 'top' | 'top-end'
  | 'right-start' | 'right' | 'right-end'
  | 'left-start' | 'left' | 'left-end';
export type CgDropDownBoxOpenReason = 'programmatic' | 'editorClick' | 'toggleButton' | 'keyboard';
export type CgDropDownBoxCloseReason =
  | 'programmatic' | 'commit' | 'cancel' | 'escape' | 'outsideClick' | 'scroll' | 'anchorLost' | 'reset';
export type CgDropDownBoxValueChangeReason = 'commit' | 'apply' | 'clear' | 'reset';
export type CgDropDownBoxTransitionPhase = 'open' | 'close' | 'afterOpen' | 'afterClose';

export interface CgDropDownBoxValueChangeDetails<TValue> {
  reason: CgDropDownBoxValueChangeReason;
  previousValue: TValue | null;
  event?: Event | SyntheticEvent;
}

export interface CgDropDownBoxValueCommittedDetails<TValue> extends CgDropDownBoxValueChangeDetails<TValue> {
  value: TValue | null;
}

export interface CgDropDownBoxOpenChangeDetails {
  reason: CgDropDownBoxOpenReason | CgDropDownBoxCloseReason;
  event?: Event | SyntheticEvent;
}

export interface CgDropDownBoxBeforeOpenDetails {
  reason: CgDropDownBoxOpenReason;
  signal: AbortSignal;
  event?: Event | SyntheticEvent;
}

export interface CgDropDownBoxBeforeCloseDetails {
  reason: CgDropDownBoxCloseReason;
  hasPendingChanges: boolean;
  signal: AbortSignal;
  event?: Event | SyntheticEvent;
}

export interface CgDropDownBoxAfterOpenDetails {
  reason: CgDropDownBoxOpenReason;
  event?: Event | SyntheticEvent;
}

export interface CgDropDownBoxAfterCloseDetails {
  reason: CgDropDownBoxCloseReason;
  event?: Event | SyntheticEvent;
}

export interface CgDropDownBoxDisplayContext<TValue> {
  value: TValue | null;
  displayText: string;
  empty: boolean;
}

export interface CgDropDownBoxActions {
  open: (reason?: CgDropDownBoxOpenReason) => Promise<void>;
  close: (reason?: CgDropDownBoxCloseReason) => Promise<void>;
  toggle: () => Promise<void>;
  clear: () => Promise<void>;
  focus: () => void;
  reposition: () => void;
  getDisplayText: () => string;
}

export interface CgDropDownBoxContext<TValue> extends CgDropDownBoxActions {
  value: TValue | null;
  pendingValue: TValue | null;
  hasPendingChanges: boolean;
  loading: boolean;
  empty: boolean;
  error: unknown;
  setPendingValue: (value: TValue | null) => void;
  commitValue: (value: TValue | null, event?: Event | SyntheticEvent) => Promise<void>;
  apply: (event?: Event | SyntheticEvent) => Promise<void>;
  cancel: (event?: Event | SyntheticEvent) => Promise<void>;
  reportLoading: (loading: boolean) => void;
  reportEmpty: (empty: boolean) => void;
  reportError: (error: unknown) => void;
}

export interface CgDropDownBoxErrorContext<TValue> {
  error: unknown;
  dropDown: CgDropDownBoxContext<TValue>;
}

export type CgDropDownBoxFormSerializer<TValue> = (value: TValue) => string | ReadonlyArray<string>;
export type CgDropDownBoxCancelableResult = void | boolean | PromiseLike<void | boolean>;

type NativeDropDownBoxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'children' | 'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'readOnly'
  | 'name' | 'form' | 'required' | 'disabled' | 'placeholder' | 'onInvalid'
>;

export interface CgDropDownBoxProps<TValue> extends NativeDropDownBoxProps, CgBaseProps {
  value?: TValue | null;
  defaultValue?: TValue | null;
  onValueChange?: (value: TValue | null, details: CgDropDownBoxValueChangeDetails<TValue>) => void;
  onValueCommitted?: (details: CgDropDownBoxValueCommittedDetails<TValue>) => void;
  getDisplayText?: (value: TValue) => string;
  displayText?: string;
  onDisplayTextChange?: (displayText: string) => void;
  emptyDisplayText?: string;
  emptyValue?: TValue | null;
  isEmptyValue?: (value: TValue | null) => boolean;
  isValueEqual?: (left: TValue | null, right: TValue | null) => boolean;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgDropDownBoxOpenChangeDetails) => void;
  onBeforeOpen?: (details: CgDropDownBoxBeforeOpenDetails) => CgDropDownBoxCancelableResult;
  onAfterOpen?: (details: CgDropDownBoxAfterOpenDetails) => void | PromiseLike<void>;
  onBeforeClose?: (details: CgDropDownBoxBeforeCloseDetails) => CgDropDownBoxCancelableResult;
  onAfterClose?: (details: CgDropDownBoxAfterCloseDetails) => void | PromiseLike<void>;
  onTransitionError?: (error: unknown, phase: CgDropDownBoxTransitionPhase) => void;
  commitMode?: CgDropDownBoxCommitMode;
  openOnEditorClick?: boolean;
  showToggleButton?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  closeOnScroll?: boolean;
  focusOnOpen?: boolean;
  returnFocusOnClose?: boolean;
  closeOnCommit?: boolean;
  openOnAltArrowDown?: boolean;
  openOnF4?: boolean;

  children?: ReactNode | ((context: CgDropDownBoxContext<TValue>) => ReactNode);
  renderDisplay?: (context: CgDropDownBoxDisplayContext<TValue>) => ReactNode;
  renderHeader?: (context: CgDropDownBoxContext<TValue>) => ReactNode;
  renderFooter?: (context: CgDropDownBoxContext<TValue>) => ReactNode;
  renderLoading?: (context: CgDropDownBoxContext<TValue>) => ReactNode;
  renderEmpty?: (context: CgDropDownBoxContext<TValue>) => ReactNode;
  renderError?: (context: CgDropDownBoxErrorContext<TValue>) => ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: unknown;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
  errorMessage?: ReactNode;

  buttons?: ReadonlyArray<CgEditorButtonDescriptor<TValue | null>>;
  clearable?: boolean;
  clearAriaLabel?: string;
  toggleAriaLabel?: string;
  onClear?: () => void;

  placement?: CgDropDownBoxPlacement;
  dropDownWidthMode?: CgDropDownBoxWidthMode;
  dropDownWidth?: CSSProperties['width'];
  dropDownHeight?: CSSProperties['height'];
  minDropDownWidth?: CSSProperties['minWidth'];
  maxDropDownWidth?: CSSProperties['maxWidth'];
  minDropDownHeight?: CSSProperties['minHeight'];
  maxDropDownHeight?: CSSProperties['maxHeight'];
  allowResize?: boolean;
  scrollable?: boolean;
  popupClassName?: string;
  popupStyle?: CSSProperties;
  popupAriaLabel?: string;

  actionsRef?: Ref<CgDropDownBoxActions>;
  serializeValue?: CgDropDownBoxFormSerializer<TValue>;
  name?: string;
  form?: string;
  required?: boolean;
  requiredErrorMessage?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
  size?: CgSizeMode;
  density?: CgDensity;
  direction?: CgDirection;
  validationState?: CgValidationState;
  fullWidth?: boolean;
}
