import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Ref } from 'react';

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export function useMergedRefs<T>(...refs: Array<Ref<T> | undefined>): Ref<T> {
  const refsRef = useRef(refs);
  useLayoutEffect(() => { refsRef.current = refs; });
  return useCallback((value: T | null) => {
    for (const ref of refsRef.current) assignRef(ref, value);
  }, []);
}
