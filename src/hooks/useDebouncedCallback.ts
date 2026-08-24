import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStableCallback } from './useStableCallback';

export interface CgDebouncedCallback<TArgs extends unknown[]> {
  schedule: (...args: TArgs) => void;
  cancel: () => void;
  flush: () => void;
}

export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
): CgDebouncedCallback<TArgs> {
  const invoke = useStableCallback(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const argsRef = useRef<TArgs | undefined>(undefined);

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    argsRef.current = undefined;
  }, []);

  const flush = useCallback(() => {
    if (!argsRef.current) return;
    const args = argsRef.current;
    cancel();
    invoke(...args);
  }, [cancel, invoke]);

  const schedule = useCallback(
    (...args: TArgs) => {
      cancel();
      argsRef.current = args;
      timerRef.current = setTimeout(flush, Math.max(0, delay));
    },
    [cancel, delay, flush],
  );

  useEffect(() => cancel, [cancel]);
  return useMemo(() => ({ schedule, cancel, flush }), [cancel, flush, schedule]);
}
