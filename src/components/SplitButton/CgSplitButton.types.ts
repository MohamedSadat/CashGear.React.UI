import type { CgButtonProps } from '../Button';
import type { CgButtonMenuCommonProps } from '../DropDownButton';

export type CgSplitButtonTogglePosition = 'start' | 'end';
export type CgSplitButtonProps<TData = unknown> = CgButtonProps & CgButtonMenuCommonProps<TData> & {
  togglePosition?: CgSplitButtonTogglePosition;
  toggleAriaLabel?: string;
  toggleTabIndex?: number;
};
