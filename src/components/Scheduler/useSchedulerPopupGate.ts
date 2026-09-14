import { useLayoutEffect, useRef } from 'react';
import { useStableCallback } from '../../hooks';
import type { CgSchedulerPopupBeforeHandler, CgSchedulerPopupContext } from './CgScheduler.types';
/** Runs cancellable opening before a controlled Popup becomes visible. */
export function useSchedulerPopupGate<T>(ownership: object, onError: (error: unknown) => void) {
  const active = useRef<AbortController | null>(null);
  useLayoutEffect(() => () => { active.current?.abort(); active.current = null; }, [ownership]);
  const cancel = useStableCallback(() => { active.current?.abort(); active.current = null; });
  const request = useStableCallback((context: CgSchedulerPopupContext<T>, before: CgSchedulerPopupBeforeHandler<T> | undefined, accept: () => void) => {
    cancel(); const controller = new AbortController(); active.current = controller;
    const current = () => !controller.signal.aborted && active.current === controller;
    try {
      const result = before?.({ ...context, signal: controller.signal });
      if (result && typeof result === 'object' && 'then' in result) void Promise.resolve(result).then(value => { if (current() && value !== false) accept(); }, error => { if (current()) onError(error); });
      else if (current() && result !== false) accept();
    } catch (error) { if (current()) onError(error); }
  });
  return { request, cancel };
}
