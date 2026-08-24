import { useEffect, useRef } from 'react';

export function useFocusReturn(active: boolean, restore = true): void {
  const previousRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (active) previousRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (!active || !restore) return;
      previousRef.current?.focus({ preventScroll: true });
    };
  }, [active, restore]);
}
