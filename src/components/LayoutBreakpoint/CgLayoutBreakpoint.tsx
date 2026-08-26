import { useCgLayoutBreakpoint } from './useCgLayoutBreakpoint';
import type { CgLayoutBreakpointProps } from './CgLayoutBreakpoint.types';

export function CgLayoutBreakpoint({ children, ...options }: CgLayoutBreakpointProps) {
  return children(useCgLayoutBreakpoint(options));
}
