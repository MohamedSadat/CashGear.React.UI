import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useStableCallback } from './useStableCallback';

export function useFormReset<TElement extends HTMLElement>(
  elementRef: RefObject<TElement | null>,
  onReset: () => void,
): void {
  const reset = useStableCallback(onReset);

  useEffect(() => {
    const form = elementRef.current?.closest('form');
    if (!form) return;
    const handleReset = () => queueMicrotask(() => reset());
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [elementRef, reset]);
}
