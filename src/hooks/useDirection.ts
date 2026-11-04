import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { CgDirection } from '../types';

function resolveDirection(element: HTMLElement | null): 'ltr' | 'rtl' {
  if (!element || typeof document === 'undefined') return 'ltr';
  const owner = element.parentElement?.closest<HTMLElement>('[dir]');
  const direction = owner?.dir || document.documentElement.dir;
  return direction.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Resolves `auto` from the parent of `elementRef`, so a control can write the
 * result to its own `dir` and still follow its parent. Point `elementRef` at
 * the outermost element that writes `dir`. A ref to anything inside it reads
 * that value back and stays on it.
 */
export function useDirection(
  elementRef: RefObject<HTMLElement | null>,
  explicit: CgDirection = 'auto',
): 'ltr' | 'rtl' {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(
    explicit === 'rtl' ? 'rtl' : 'ltr',
  );

  // A layout effect, so a control that writes `dir` never paints as LTR first.
  useLayoutEffect(() => {
    if (explicit !== 'auto') return;
    const update = () => setDirection(resolveDirection(elementRef.current));
    update();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [elementRef, explicit]);

  return explicit === 'auto' ? direction : explicit;
}
