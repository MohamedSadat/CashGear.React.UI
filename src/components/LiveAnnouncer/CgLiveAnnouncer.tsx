import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { cx } from '../../utils';
import styles from './CgLiveAnnouncer.module.css';
import type { CgLiveAnnouncerHandle, CgLiveAnnouncerProps } from './CgLiveAnnouncer.types';

interface Pending {
  frame: number | null;
  timer: ReturnType<typeof setTimeout> | null;
}

function cancelPending(pending: Pending): void {
  if (pending.frame !== null) cancelAnimationFrame(pending.frame);
  if (pending.timer !== null) clearTimeout(pending.timer);
  pending.frame = null;
  pending.timer = null;
}

/**
 * A visually hidden live region spoken through its handle. Nothing is kept in React state, so
 * announcing during a drag or while typing draws nothing.
 */
export const CgLiveAnnouncer = forwardRef<CgLiveAnnouncerHandle, CgLiveAnnouncerProps>(function CgLiveAnnouncer(
  { politeness = 'polite', clearAfter, className, ...nativeProps },
  forwardedRef,
) {
  if (clearAfter !== undefined && (!Number.isFinite(clearAfter) || clearAfter <= 0)) {
    throw new RangeError('CgLiveAnnouncer clearAfter must be a positive number of milliseconds.');
  }
  const regionRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Pending>({ frame: null, timer: null });
  const clearAfterRef = useRef(clearAfter);
  useLayoutEffect(() => { clearAfterRef.current = clearAfter; }, [clearAfter]);

  useImperativeHandle(forwardedRef, () => ({
    announce(message: string) {
      const region = regionRef.current;
      const pending = pendingRef.current;
      if (!region) return;
      cancelPending(pending);
      region.textContent = '';
      if (!message.trim()) return;
      pending.frame = requestAnimationFrame(() => {
        pending.frame = null;
        if (!regionRef.current) return;
        regionRef.current.textContent = message;
        const delay = clearAfterRef.current;
        if (delay === undefined) return;
        pending.timer = setTimeout(() => {
          pending.timer = null;
          if (regionRef.current) regionRef.current.textContent = '';
        }, delay);
      });
    },
    clear() {
      cancelPending(pendingRef.current);
      if (regionRef.current) regionRef.current.textContent = '';
    },
  }), []);

  useEffect(() => {
    const pending = pendingRef.current;
    return () => cancelPending(pending);
  }, []);

  return <div
    {...nativeProps}
    ref={regionRef}
    className={cx(styles.root, className)}
    role={politeness === 'assertive' ? 'alert' : 'status'}
    aria-live={politeness}
    aria-atomic="true"
    data-cg-live-announcer=""
  />;
});
