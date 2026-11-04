import { useEffect, useRef } from 'react';

export function useFocusReturn(active: boolean, restore = true): void {
  const previousRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (active) previousRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (!active || !restore) return;
      // A click outside, such as on an input, has already moved focus where the user wants it.
      const current = document.activeElement;
      if (current instanceof HTMLElement && current !== document.body && !current.closest('[data-cg-overlay-portal],[hidden],[inert]')) return;
      previousRef.current?.focus({ preventScroll: true });
    };
  }, [active, restore]);
}
