import { createContext, createElement, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useStableCallback } from '../hooks';

export type OverlaySurfaceKind = 'transient' | 'modal' | 'window';

interface OverlayEntry {
  id: string;
  identity: object;
  sequence: number;
  kind: OverlaySurfaceKind;
  elementRef?: RefObject<HTMLElement | null>;
  boundaryRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  ownerId?: string;
  exclusiveGroup?: string;
  onEscape?: (event: KeyboardEvent) => void;
  onOutside?: (event: PointerEvent) => void | boolean | PromiseLike<void | boolean>;
  onSuperseded?: () => void | boolean | PromiseLike<void | boolean>;
}

interface OverlaySurfaceOptions {
  active: boolean;
  kind?: OverlaySurfaceKind;
  elementRef?: RefObject<HTMLElement | null>;
  boundaryRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
  onEscape?: (event: KeyboardEvent) => void;
  onOutside?: (event: PointerEvent) => void | boolean | PromiseLike<void | boolean>;
  exclusiveGroup?: string;
  onSuperseded?: () => void | boolean | PromiseLike<void | boolean>;
}

const OverlayOwnerContext = createContext<string | undefined>(undefined);
const overlays: OverlayEntry[] = [];
const listeners = new Set<() => void>();
let nextOverlayId = 0;
let nextSequence = 0;
let stackVersion = 0;
let listeningDocument: Document | undefined;
let pendingOutside: { pointerId: number; ids: string[] } | undefined;

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

function rootEntry(entry: OverlayEntry): OverlayEntry {
  let current = entry;
  const seen = new Set<string>();
  while (current.ownerId && !seen.has(current.ownerId)) {
    seen.add(current.ownerId);
    const owner = overlays.find((candidate) => candidate.id === current.ownerId);
    if (!owner) break;
    current = owner;
  }
  return current;
}

function layer(entry: OverlayEntry): number {
  const kind = rootEntry(entry).kind;
  return kind === 'modal' ? 3 : kind === 'transient' ? 2 : 1;
}

function normalizeOverlays(): void {
  overlays.sort((left, right) => {
    if (isDescendant(left, right)) return 1;
    if (isDescendant(right, left)) return -1;
    const layerDifference = layer(left) - layer(right);
    if (layerDifference !== 0) return layerDifference;
    return rootEntry(left).sequence - rootEntry(right).sequence || left.sequence - right.sequence;
  });
}

function eventPath(event: Event): EventTarget[] {
  return typeof event.composedPath === 'function' ? event.composedPath() : [event.target as EventTarget];
}

function elementInPath(entry: OverlayEntry, path: EventTarget[]): boolean {
  const element = entry.elementRef?.current;
  const elements = [element, ...(entry.boundaryRefs?.map((ref) => ref.current) ?? [])];
  return elements.some((candidate) => Boolean(candidate && path.some((target) => target instanceof Node && candidate.contains(target))));
}

function isDescendant(candidate: OverlayEntry, ancestor: OverlayEntry): boolean {
  let ownerId = candidate.ownerId;
  const seen = new Set<string>();
  while (ownerId && !seen.has(ownerId)) {
    if (ownerId === ancestor.id) return true;
    seen.add(ownerId);
    ownerId = overlays.find((entry) => entry.id === ownerId)?.ownerId;
  }
  return false;
}

export function isOverlayOwnedBy(candidateId: string, ancestorId: string): boolean {
  const candidate = overlays.find((entry) => entry.id === candidateId);
  const ancestor = overlays.find((entry) => entry.id === ancestorId);
  return Boolean(candidate && ancestor && (candidate === ancestor || isDescendant(candidate, ancestor)));
}

export function overlayOwnsNode(id: string, node: Node): boolean {
  const entry = overlays.find((candidate) => candidate.id === id);
  if (!entry) return false;
  const boundary = node instanceof Element
    ? node.closest<HTMLElement>('[data-cg-overlay-boundary]')
    : node.parentElement?.closest<HTMLElement>('[data-cg-overlay-boundary]');
  const boundaryOwner = boundary?.dataset.cgOverlayBoundary;
  if (boundaryOwner && isOverlayOwnedBy(boundaryOwner, id)) return true;
  const direct = entry.elementRef?.current?.contains(node)
    || entry.boundaryRefs?.some((ref) => ref.current?.contains(node));
  if (direct) return true;
  return overlays.some((candidate) => isDescendant(candidate, entry) && Boolean(candidate.elementRef?.current?.contains(node)));
}

function containsBoundary(entry: OverlayEntry, path: EventTarget[]): boolean {
  return path.some((target) => {
    if (!(target instanceof Element) || !target.hasAttribute('data-cg-overlay-boundary')) return false;
    const owner = target.getAttribute('data-cg-overlay-boundary');
    return owner === entry.id;
  });
}

function contains(entry: OverlayEntry, path: EventTarget[]): boolean {
  if (elementInPath(entry, path) || containsBoundary(entry, path)) return true;
  return overlays.some((candidate) => candidate !== entry && isDescendant(candidate, entry) && elementInPath(candidate, path));
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const path = eventPath(event);
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    const entry = overlays[index];
    if (!entry) continue;
    const owns = entry.kind !== 'window' || contains(entry, path)
      || (document.activeElement instanceof Node && Boolean(entry.elementRef?.current?.contains(document.activeElement)));
    if (!owns) {
      if (entry.kind === 'modal') return;
      continue;
    }
    if (!entry.onEscape) return;
    event.preventDefault();
    event.stopPropagation();
    entry.onEscape(event);
    return;
  }
}

function outsideTargets(event: PointerEvent): string[] {
  const path = eventPath(event);
  const targets: string[] = [];
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    const entry = overlays[index];
    if (!entry) continue;
    if (contains(entry, path)) break;
    if (!entry.onOutside) break;
    targets.push(entry.id);
  }
  return targets;
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    pendingOutside = undefined;
    return;
  }
  const ids = outsideTargets(event);
  pendingOutside = ids.length > 0 ? { pointerId: event.pointerId, ids } : undefined;
}

async function dismissOutsideInOrder(event: PointerEvent, ids: string[]) {
  for (const id of ids) {
    const result = overlays.find((entry) => entry.id === id)?.onOutside?.(event);
    const accepted = result && typeof result === 'object' && 'then' in result ? await result : result;
    if (accepted === false) return;
  }
}

function onPointerUp(event: PointerEvent) {
  const started = pendingOutside;
  pendingOutside = undefined;
  if (!started || started.pointerId !== event.pointerId) return;
  const released = new Set(outsideTargets(event));
  void dismissOutsideInOrder(event, started.ids.filter((id) => released.has(id)));
}

function onPointerCancel() { pendingOutside = undefined; }

function attach(document: Document) {
  if (listeningDocument === document) return;
  if (listeningDocument) {
    listeningDocument.removeEventListener('keydown', onKeyDown, true);
    listeningDocument.removeEventListener('pointerdown', onPointerDown, true);
    listeningDocument.removeEventListener('pointerup', onPointerUp, true);
    listeningDocument.removeEventListener('pointercancel', onPointerCancel, true);
  }
  listeningDocument = document;
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);
}

function detachWhenEmpty() {
  if (overlays.length > 0 || !listeningDocument) return;
  listeningDocument.removeEventListener('keydown', onKeyDown, true);
  listeningDocument.removeEventListener('pointerdown', onPointerDown, true);
  listeningDocument.removeEventListener('pointerup', onPointerUp, true);
  listeningDocument.removeEventListener('pointercancel', onPointerCancel, true);
  listeningDocument = undefined;
  pendingOutside = undefined;
}

export function raiseOverlay(id: string): void {
  const index = overlays.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const entry = overlays[index];
  if (!entry) return;
  const root = rootEntry(entry);
  const currentLayer = layer(entry);
  const alreadyRaised = overlays.every((candidate) => (
    layer(candidate) !== currentLayer
    || rootEntry(candidate) === root
    || rootEntry(candidate).sequence <= root.sequence
  ));
  if (alreadyRaised) return;
  root.sequence = ++nextSequence;
  normalizeOverlays();
  notify();
}

export function getTopmostModalId(): string | undefined {
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    if (overlays[index]?.kind === 'modal') return overlays[index]?.id;
  }
  return undefined;
}

export function isTopmostOverlay(id: string): boolean {
  return overlays.at(-1)?.id === id;
}

export async function requestExclusiveOverlay(group: string | undefined, ownerId?: string): Promise<boolean> {
  if (!group || ownerId) return true;
  let incumbent: OverlayEntry | undefined;
  for (let index = overlays.length - 1; index >= 0; index -= 1) {
    const candidate = overlays[index];
    if (candidate?.exclusiveGroup === group && !candidate.ownerId) {
      incumbent = candidate;
      break;
    }
  }
  if (!incumbent) return true;
  try {
    const result = incumbent.onSuperseded?.();
    const accepted = result && typeof result === 'object' && 'then' in result ? await result : result;
    return accepted !== false;
  } catch {
    return false;
  }
}

export function useOverlaySurface(options: OverlaySurfaceOptions) {
  const [identity] = useState(() => ({}));
  const [id] = useState(() => `cg-overlay-${++nextOverlayId}`);
  const ownerId = useContext(OverlayOwnerContext);
  const onEscape = useStableCallback(options.onEscape);
  const onOutside = useStableCallback(options.onOutside);
  const onSuperseded = useStableCallback(options.onSuperseded);
  const hasEscape = options.onEscape !== undefined;
  const hasOutside = options.onOutside !== undefined;
  const hasSuperseded = options.onSuperseded !== undefined;
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!options.active) return undefined;
    const entry: OverlayEntry = {
      id,
      identity,
      sequence: ++nextSequence,
      kind: options.kind ?? 'transient',
      ...(options.elementRef ? { elementRef: options.elementRef } : {}),
      ...(options.boundaryRefs ? { boundaryRefs: options.boundaryRefs } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(options.exclusiveGroup ? { exclusiveGroup: options.exclusiveGroup } : {}),
      ...(hasEscape ? { onEscape } : {}),
      ...(hasOutside ? { onOutside } : {}),
      ...(hasSuperseded ? { onSuperseded } : {}),
    };
    overlays.push(entry);
    normalizeOverlays();
    attach(document);
    notify();
    return () => {
      const index = overlays.findIndex((item) => item.identity === identity);
      if (index >= 0) overlays.splice(index, 1);
      if (pendingOutside) pendingOutside.ids = pendingOutside.ids.filter((pendingId) => pendingId !== id);
      detachWhenEmpty();
      notify();
    };
  }, [hasEscape, hasOutside, hasSuperseded, id, identity, onEscape, onOutside, onSuperseded, options.active, options.boundaryRefs, options.elementRef, options.exclusiveGroup, options.kind, ownerId]);

  const entry = overlays.find((candidate) => candidate.identity === identity);
  const rootKind = entry ? rootEntry(entry).kind : options.kind ?? 'transient';
  return {
    id,
    ownerId,
    order: entry ? overlays.indexOf(entry) + 1 : 0,
    isTopmost: overlays.at(-1)?.identity === identity,
    rootKind,
    raise: () => raiseOverlay(id),
  } as const;
}

export function OverlayOwnerProvider({ id, children }: { id: string; children: ReactNode }) {
  return createElement(OverlayOwnerContext.Provider, { value: id }, children);
}

export function useOverlayOwnerId(): string | undefined {
  return useContext(OverlayOwnerContext);
}

/** Backward-compatible adapter for existing editor overlays. */
export function useOverlayStack(
  active: boolean,
  dismiss?: () => void,
  elementRef?: RefObject<HTMLElement | null>,
  dismissOutside?: () => void | boolean | PromiseLike<void | boolean>,
  boundaryRef?: RefObject<HTMLElement | null>,
) {
  const boundaryRefs = useMemo(() => boundaryRef ? [boundaryRef] : undefined, [boundaryRef]);
  return useOverlaySurface({
    active,
    kind: 'transient',
    ...(elementRef ? { elementRef } : {}),
    ...(boundaryRefs ? { boundaryRefs } : {}),
    ...(dismiss ? { onEscape: () => dismiss() } : {}),
    ...(dismissOutside ? { onOutside: () => dismissOutside() } : {}),
  });
}
