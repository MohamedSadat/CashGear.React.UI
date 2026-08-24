import { useCallback, useEffect, useRef, useState } from 'react';

export interface CgAsyncOperationContext {
  signal: AbortSignal;
  generation: number;
}

export function useAsyncOperation() {
  const [pending, setPending] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    if (mountedRef.current) setPending(false);
  }, []);

  const run = useCallback(
    async <T,>(operation: (context: CgAsyncOperationContext) => Promise<T>): Promise<T> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const generation = ++generationRef.current;
      setPending(true);
      try {
        return await operation({ signal: controller.signal, generation });
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = undefined;
          if (mountedRef.current) setPending(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  return { pending, run, cancel, generationRef } as const;
}
