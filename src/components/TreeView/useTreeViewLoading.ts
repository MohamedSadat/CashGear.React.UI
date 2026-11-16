import { useEffect, useRef, useState } from 'react';
import { useStableCallback } from '../../hooks';

/** A lazy node's children: being loaded, failed to load, or loaded (the caller gives them in `nodes`). */
export type TreeViewLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: unknown }
  | { readonly status: 'loaded' };

export interface TreeViewLoadingOptions {
  /** Loads are made at all (`loadChildren` was given). */
  enabled: boolean;
  /** The nodes expanded now. */
  expanded: ReadonlySet<string>;
  /** The node says it has children and none were given yet. */
  needsLoad: (key: string) => boolean;
  load: (key: string, signal: AbortSignal, source: 'expand' | 'retry') => PromiseLike<void>;
  onError?: (key: string, error: unknown) => void;
}

/**
 * Loads a lazy node's children when it is expanded, one load per node at a time. Collapsing the
 * node aborts its load and forgets how it ended, so the next expand loads again; a retry aborts
 * the load before it. Late results of an aborted load are dropped.
 */
export function useTreeViewLoading({ enabled, expanded, needsLoad, load, onError }: TreeViewLoadingOptions) {
  const [states, setStates] = useState<ReadonlyMap<string, TreeViewLoadState>>(() => new Map());
  const [seenExpanded, setSeenExpanded] = useState(expanded);
  const controllers = useRef(new Map<string, AbortController>());
  const torn = useRef(false);

  // A collapsed node forgets how its load went, so its next expand loads again.
  if (seenExpanded !== expanded) {
    setSeenExpanded(expanded);
    if ([...states.keys()].some((key) => !expanded.has(key))) setStates(new Map([...states].filter(([key]) => expanded.has(key))));
  }

  const settle = (key: string, state: TreeViewLoadState): void => {
    setStates((current) => new Map(current).set(key, state));
  };

  const start = useStableCallback((key: string, source: 'expand' | 'retry'): void => {
    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);
    settle(key, { status: 'loading' });
    const current = () => !controller.signal.aborted && controllers.current.get(key) === controller;
    const run = async (): Promise<void> => { await load(key, controller.signal, source); };
    void run().then(() => {
      if (!current()) return;
      controllers.current.delete(key);
      settle(key, { status: 'loaded' });
    }, (error: unknown) => {
      if (!current()) return;
      controllers.current.delete(key);
      settle(key, Object.freeze({ status: 'error', error }));
      onError?.(key, error);
    });
  });

  useEffect(() => {
    if (!enabled) return;
    for (const [key, controller] of controllers.current) {
      if (expanded.has(key)) continue;
      controller.abort();
      controllers.current.delete(key);
    }
    // Loads cut off by an unmount that was not one (Strict Mode runs effects twice) start again.
    const remounted = torn.current;
    torn.current = false;
    for (const key of expanded) {
      const state = states.get(key);
      if ((!state || (remounted && state.status === 'loading')) && needsLoad(key)) start(key, 'expand');
    }
  }, [enabled, expanded, needsLoad, start, states]);

  useEffect(() => {
    const owned = controllers.current;
    return () => {
      for (const controller of owned.values()) controller.abort();
      owned.clear();
      torn.current = true;
    };
  }, []);

  return { states, retry: (key: string) => start(key, 'retry') } as const;
}
