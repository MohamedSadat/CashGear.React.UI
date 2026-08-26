import { useEffect, useLayoutEffect, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import { useControllableState, useStableCallback } from '../hooks';
import type { CgOverlayCancelableResult, CgOverlayLifecyclePhase } from '../types';

interface LifecycleDetails { reason: string; event?: Event | SyntheticEvent; }
interface OverlayLifecycleOptions<TOpen extends LifecycleDetails, TClose extends LifecycleDetails> {
  componentName: string;
  open: boolean | undefined;
  defaultOpen: boolean;
  createOpenDetails: (event?: Event | SyntheticEvent) => TOpen;
  onOpenChange?: (open: boolean, details: TOpen | TClose) => void;
  onBeforeOpen?: (details: TOpen & { signal: AbortSignal }) => CgOverlayCancelableResult;
  onAfterOpen?: (details: TOpen) => void | PromiseLike<void>;
  onBeforeClose?: (details: TClose & { signal: AbortSignal }) => CgOverlayCancelableResult;
  onAfterClose?: (details: TClose) => void | PromiseLike<void>;
  onLifecycleError?: (error: unknown, phase: CgOverlayLifecyclePhase) => void;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && typeof (value as PromiseLike<unknown>).then === 'function';
}

export function useOverlayLifecycle<TOpen extends LifecycleDetails, TClose extends LifecycleDetails>(
  options: OverlayLifecycleOptions<TOpen, TClose>,
) {
  const [actualOpen, setActualOpen] = useControllableState(options.open, options.defaultOpen, `${options.componentName} open`);
  const openRef = useRef(actualOpen);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const transitionRef = useRef<AbortController | undefined>(undefined);
  const pendingDetailsRef = useRef<TOpen | TClose | undefined>(undefined);
  const previousOpenRef = useRef(false);

  useLayoutEffect(() => { openRef.current = actualOpen; }, [actualOpen]);

  const reportError = useStableCallback((error: unknown, phase: CgOverlayLifecyclePhase) => {
    try { options.onLifecycleError?.(error, phase); } catch { /* Error reporting is terminal. */ }
  });

  const begin = useStableCallback(() => {
    transitionRef.current?.abort();
    const controller = new AbortController();
    transitionRef.current = controller;
    return { controller, generation: ++generationRef.current };
  });

  const isCurrent = useStableCallback((transition: { controller: AbortController; generation: number }) => (
    mountedRef.current
    && !transition.controller.signal.aborted
    && generationRef.current === transition.generation
  ));

  const requestOpen = useStableCallback(async (details: TOpen = options.createOpenDetails()): Promise<boolean> => {
    const transition = begin();
    if (openRef.current) return true;
    try {
      const result = options.onBeforeOpen?.({ ...details, signal: transition.controller.signal });
      const accepted = isPromiseLike(result) ? await result : result;
      if (!isCurrent(transition) || accepted === false) return false;
    } catch (error) {
      if (isCurrent(transition)) reportError(error, 'beforeOpen');
      return false;
    }
    pendingDetailsRef.current = details;
    setActualOpen(true);
    options.onOpenChange?.(true, details);
    return options.open === undefined;
  });

  const requestClose = useStableCallback(async (details: TClose): Promise<boolean> => {
    const transition = begin();
    if (!openRef.current) return true;
    try {
      const result = options.onBeforeClose?.({ ...details, signal: transition.controller.signal });
      const accepted = isPromiseLike(result) ? await result : result;
      if (!isCurrent(transition) || accepted === false) return false;
    } catch (error) {
      if (isCurrent(transition)) reportError(error, 'beforeClose');
      return false;
    }
    pendingDetailsRef.current = details;
    setActualOpen(false);
    options.onOpenChange?.(false, details);
    return options.open === undefined;
  });

  useEffect(() => {
    if (actualOpen === previousOpenRef.current) return;
    previousOpenRef.current = actualOpen;
    const details = pendingDetailsRef.current ?? options.createOpenDetails();
    pendingDetailsRef.current = undefined;
    try {
      const result = actualOpen
        ? options.onAfterOpen?.(details as TOpen)
        : options.onAfterClose?.(details as TClose);
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch((error: unknown) => reportError(error, actualOpen ? 'afterOpen' : 'afterClose'));
      }
    } catch (error) {
      reportError(error, actualOpen ? 'afterOpen' : 'afterClose');
    }
  }, [actualOpen, options, reportError]);

  useEffect(() => () => {
    mountedRef.current = false;
    transitionRef.current?.abort();
    generationRef.current += 1;
  }, []);

  return { open: actualOpen, openRef, requestOpen, requestClose } as const;
}
