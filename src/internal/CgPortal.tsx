import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface CgPortalProps { children: ReactNode; target?: Element | string | null; }
const subscribe = () => () => undefined;

export function CgPortal({ children, target }: CgPortalProps) {
  const canPortal = useSyncExternalStore(subscribe, () => typeof document !== 'undefined', () => false);
  if (!canPortal || typeof document === 'undefined') return null;
  const resolved = typeof target === 'string' ? document.querySelector(target) : target;
  return createPortal(children, resolved ?? document.body);
}
