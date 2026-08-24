import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Ref } from 'react';

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export function useMergedRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  const refsRef = useRef(refs);
  const valueRef = useRef<T | null>(null);
  useLayoutEffect(() => {
    const previous = refsRef.current;
    for (const oldRef of previous) {
      if (oldRef && !refs.includes(oldRef)) assignRef(oldRef, null);
    }
    for (const nextRef of refs) {
      if (nextRef && !previous.includes(nextRef) && valueRef.current !== null) {
        assignRef(nextRef, valueRef.current);
      }
    }
    refsRef.current = refs;
  });
  return useCallback((value: T | null) => {
    valueRef.current = value;
    for (const ref of refsRef.current) assignRef(ref, value);
  }, []);
}
