import type { ReactNode } from 'react';

export type CgLayoutBreakpointSize = 'x-small' | 'small' | 'medium' | 'large' | 'x-large';

interface CgLayoutBreakpointCommonOptions {
  defaultMatches?: boolean;
  onMatchChange?: (matches: boolean) => void;
}

export type CgLayoutBreakpointQuery =
  | { size: CgLayoutBreakpointSize; minWidth?: never; maxWidth?: never }
  | { size?: never; minWidth: number; maxWidth?: number }
  | { size?: never; minWidth?: number; maxWidth: number };

export type UseCgLayoutBreakpointOptions = CgLayoutBreakpointCommonOptions & CgLayoutBreakpointQuery;

export type CgLayoutBreakpointProps = UseCgLayoutBreakpointOptions & {
  children: (matches: boolean) => ReactNode;
};
