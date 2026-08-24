import { useEffect, useState } from 'react';
import { useStableCallback } from '../hooks';

interface OverlayEntry { id: number; dismiss?: () => void; }
const overlays: OverlayEntry[] = [];
let nextOverlayId = 0;
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

export function useOverlayStack(active: boolean, dismiss?: () => void) {
  const [identity] = useState(() => ({ id: ++nextOverlayId }));
  const stableDismiss = useStableCallback(dismiss);
  useEffect(() => {
    if (!active) return undefined;
    const entry: OverlayEntry = { id: identity.id, dismiss: dismiss ? stableDismiss : undefined };
    overlays.push(entry);
    attach(document);
    return () => {
      const index = overlays.findIndex((item) => item.id === entry.id);
      if (index >= 0) overlays.splice(index, 1);
      detachWhenEmpty();
    };
  }, [active, dismiss, identity.id, stableDismiss]);
  return { order: identity.id } as const;
}
