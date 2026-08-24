import { useEffect, useState, useSyncExternalStore } from 'react';
import { useStableCallback } from '../hooks';

interface OverlayEntry { id: number; identity: object; dismiss?: () => void; }
const overlays: OverlayEntry[] = [];
const listeners = new Set<() => void>();
let nextOverlayId = 0;
let stackVersion = 0;
let listeningDocument: Document | undefined;

const onEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') overlays.at(-1)?.dismiss?.();
};

function attach(document: Document) {
  if (listeningDocument === document) return;
  listeningDocument?.removeEventListener('keydown', onEscape);
  listeningDocument = document;
  document.addEventListener('keydown', onEscape);
}

function detachWhenEmpty() {
  if (overlays.length > 0) return;
  listeningDocument?.removeEventListener('keydown', onEscape);
  listeningDocument = undefined;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => stackVersion;
const getServerSnapshot = () => 0;
const notify = () => {
  stackVersion += 1;
  listeners.forEach((listener) => listener());
};

export function useOverlayStack(active: boolean, dismiss?: () => void) {
  const [identity] = useState(() => ({}));
  const stableDismiss = useStableCallback(dismiss);
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (!active) return undefined;
    const entry: OverlayEntry = { id: ++nextOverlayId, identity, dismiss: dismiss ? stableDismiss : undefined };
    overlays.push(entry);
    attach(document);
    notify();
    return () => {
      const index = overlays.findIndex((item) => item.id === entry.id);
      if (index >= 0) overlays.splice(index, 1);
      detachWhenEmpty();
      notify();
    };
  }, [active, dismiss, identity, stableDismiss]);
  const order = overlays.find((entry) => entry.identity === identity)?.id ?? 0;
  const isTopmost = overlays.at(-1)?.identity === identity;
  return { order, isTopmost } as const;
}
