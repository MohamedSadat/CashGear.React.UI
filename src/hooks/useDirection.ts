import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { CgDirection } from '../types';

function resolveDirection(element: HTMLElement | null): 'ltr' | 'rtl' {
  if (!element || typeof document === 'undefined') return 'ltr';
  const owner = element.closest<HTMLElement>('[dir]');
  const direction = owner?.dir || document.documentElement.dir;
  return direction.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}

export function useDirection(
  elementRef: RefObject<HTMLElement | null>,
  explicit: CgDirection = 'auto',
): 'ltr' | 'rtl' {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(
    explicit === 'rtl' ? 'rtl' : 'ltr',
  );

  useEffect(() => {
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
