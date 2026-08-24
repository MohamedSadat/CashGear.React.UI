import { useCallback, useLayoutEffect, useRef } from 'react';

export function useStableCallback<TArgs extends unknown[], TResult>(
  callback: ((...args: TArgs) => TResult) | undefined,
): (...args: TArgs) => TResult | undefined {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);

  return useCallback((...args: TArgs) => callbackRef.current?.(...args), []);
}
