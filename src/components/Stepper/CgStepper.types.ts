import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgDirection, CgIconSource, CgOrientation, CgSizeMode, CgValidationState } from '../../types';

export type CgStepperChangeSource = 'pointer' | 'keyboard' | 'action' | 'collection' | 'external';
export type CgStepperCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgStepDescriptor<TData = unknown> {
  key: string;
  label: string;
  description?: ReactNode;
  indicatorText?: string;
  icon?: CgIconSource;
  hint?: string;
  optional?: boolean;
  disabled?: boolean;
  skipped?: boolean;
  completed?: boolean;
  validationState?: CgValidationState;
  selectable?: boolean;
  canEnter?: (details: CgStepperGuardDetails<TData>) => CgStepperCancelableResult;
  canLeave?: (details: CgStepperGuardDetails<TData>) => CgStepperCancelableResult;
  content?: ReactNode;
  renderIndicator?: (context: CgStepRenderContext<TData>) => ReactNode;
  renderLabel?: (context: CgStepRenderContext<TData>) => ReactNode;
  renderConnector?: (context: CgStepRenderContext<TData>) => ReactNode;
  data?: TData;
}

export interface CgStepperSelectionChangeDetails<TData = unknown> {
  previousKey: string | null;
  selectedKey: string | null;
  previousIndex: number;
  selectedIndex: number;
  source: CgStepperChangeSource;
  isUserInitiated: boolean;
  previousStep?: CgStepDescriptor<TData>;
  step?: CgStepDescriptor<TData>;
  event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgStepperGuardDetails<TData = unknown> extends CgStepperSelectionChangeDetails<TData> {
  signal: AbortSignal;
}

export interface CgStepRenderContext<TData = unknown> {
  step: CgStepDescriptor<TData>;
  index: number;
  active: boolean;
  focused: boolean;
  completed: boolean;
  available: boolean;
  defaultContent: ReactNode;
}

export interface CgStepperLabels {
  optional: string;
  completed: string;
  error: string;
  warning: string;
  success: string;
  skipped: string;
  disabled: string;
  progress: string;
}

export interface CgStepperActions {
  focus: () => void;
  focusStep: (key: string) => void;
  selectStep: (key: string) => Promise<boolean>;
  next: () => Promise<boolean>;
  previous: () => Promise<boolean>;
}

type NativeStepperProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'onChange'>;

export interface CgStepperProps<TData = unknown> extends NativeStepperProps {
  steps: ReadonlyArray<CgStepDescriptor<TData>>;
  selectedKey?: string | null;
  defaultSelectedKey?: string | null;
  onSelectedKeyChange?: (key: string | null, details: CgStepperSelectionChangeDetails<TData>) => void;
  beforeSelectionChange?: (details: CgStepperGuardDetails<TData>) => CgStepperCancelableResult;
  afterSelectionChange?: (details: CgStepperSelectionChangeDetails<TData>) => void | PromiseLike<void>;
  onSelectionError?: (error: unknown, details: CgStepperSelectionChangeDetails<TData>) => void;
  linear?: boolean;
  allowStepSelection?: boolean;
  allowBackwardNavigation?: boolean;
  allowReselectCurrentStep?: boolean;
  selectOnFocus?: boolean;
  orientation?: CgOrientation;
  direction?: CgDirection;
  size?: CgSizeMode;
  showLabels?: boolean;
  showConnectors?: boolean;
  renderActiveContent?: boolean;
  readOnly?: boolean;
  labels?: Partial<CgStepperLabels>;
  renderIndicator?: (context: CgStepRenderContext<TData>) => ReactNode;
  renderLabel?: (context: CgStepRenderContext<TData>) => ReactNode;
  renderConnector?: (context: CgStepRenderContext<TData>) => ReactNode;
  emptyContent?: ReactNode;
  actionsRef?: Ref<CgStepperActions>;
}
