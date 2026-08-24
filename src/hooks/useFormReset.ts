import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useStableCallback } from './useStableCallback';

interface FormAssociatedElement extends HTMLElement {
  readonly form: HTMLFormElement | null;
}

export function useFormReset<TElement extends FormAssociatedElement>(
  elementRef: RefObject<TElement | null>,
  onReset: () => void,
): void {
  const reset = useStableCallback(onReset);

  useEffect(() => {
    const element = elementRef.current;
    const form = element?.form ?? element?.closest('form');
    if (!form) return;
    const handleReset = () => queueMicrotask(() => reset());
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [elementRef, reset]);
}
