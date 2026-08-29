import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { CgOverlayPoint } from '../types';
import { acquireInert } from './inert';
import { getTopmostModalId, isOverlayOwnedBy, overlayOwnsNode } from './overlayStack';

const FOCUSABLE = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function visibleFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => (
    !element.hidden
    && !element.closest('[hidden],[inert],[aria-hidden="true"]')
    && getComputedStyle(element).visibility !== 'hidden'
    && getComputedStyle(element).display !== 'none'
  ));
}

export function focusOverlayInitial(surface: HTMLElement | null): void {
  if (!surface) return;
  const explicit = surface.querySelector<HTMLElement>('[data-cg-autofocus]:not(:disabled)');
  const body = surface.querySelector<HTMLElement>('[data-cg-overlay-body]');
  const first = explicit ?? (body ? visibleFocusable(body)[0] : undefined) ?? surface;
  first.focus({ preventScroll: true });
}

export function useModalFocusTrap(active: boolean, id: string, surfaceRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) return undefined;
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    queueMicrotask(() => {
      if (getTopmostModalId() === id) focusOverlayInitial(surfaceRef.current);
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || getTopmostModalId() !== id) return;
      const current = surfaceRef.current;
      if (!current) return;
      const focusable = visibleFocusable(current);
      if (focusable.length === 0) {
        event.preventDefault();
        current.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      const focused = document.activeElement;
      if (focused instanceof Node && !current.contains(focused) && overlayOwnsNode(id, focused)) return;
      if (event.shiftKey && (focused === first || !current.contains(focused))) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && (focused === last || !current.contains(focused))) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (getTopmostModalId() !== id) return;
      const current = surfaceRef.current;
      if (!current || (event.target instanceof Node && overlayOwnsNode(id, event.target))) return;
      focusOverlayInitial(current);
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [active, id, surfaceRef]);
}

let scrollLockDepth = 0;
let scrollLockState: {
  bodyOverflow: string;
  bodyPaddingRight: string;
  rootOverflow: string;
  scrollX: number;
  scrollY: number;
} | undefined;

function acquireScrollLock(): () => void {
  if (scrollLockDepth === 0) {
    const body = document.body;
    const root = document.documentElement;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    scrollLockState = {
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      rootOverflow: root.style.overflow,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    if (scrollbarWidth > 0) {
      const current = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
  }
  scrollLockDepth += 1;
  let released = false;
  return () => {
    if (released || scrollLockDepth === 0) return;
    released = true;
    scrollLockDepth -= 1;
    if (scrollLockDepth !== 0 || !scrollLockState) return;
    const state = scrollLockState;
    scrollLockState = undefined;
    document.body.style.overflow = state.bodyOverflow;
    document.body.style.paddingRight = state.bodyPaddingRight;
    document.documentElement.style.overflow = state.rootOverflow;
    if (window.scrollX !== state.scrollX || window.scrollY !== state.scrollY) window.scrollTo(state.scrollX, state.scrollY);
  };
}

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    return acquireScrollLock();
  }, [active]);
}

const modalRoots = new Map<string, HTMLElement>();
const isolatedBodyChildren = new Map<Element, () => void>();
let isolationObserver: MutationObserver | undefined;

function containsOwnedOverlay(element: Element, topmostId: string): boolean {
  const overlayIds = [
    ...(element.hasAttribute('data-cg-overlay-id') ? [element] : []),
    ...element.querySelectorAll('[data-cg-overlay-id]'),
  ];
  if (overlayIds.some((candidate) => {
    const id = candidate.getAttribute('data-cg-overlay-id');
    return Boolean(id && isOverlayOwnedBy(id, topmostId));
  })) return true;
  const boundaries = [
    ...(element.hasAttribute('data-cg-overlay-boundary') ? [element] : []),
    ...element.querySelectorAll('[data-cg-overlay-boundary]'),
  ];
  return boundaries.some((boundary) => {
    const owner = boundary.getAttribute('data-cg-overlay-boundary');
    return Boolean(owner && isOverlayOwnedBy(owner, topmostId));
  });
}

function refreshModalIsolation(): void {
  const topmostId = getTopmostModalId();
  const root = topmostId ? modalRoots.get(topmostId) : undefined;
  const candidates: Element[] = [];
  if (topmostId && root?.isConnected) {
    let branch: Element = root;
    let parent = branch.parentElement;
    while (parent) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === branch || containsOwnedOverlay(sibling, topmostId)) continue;
        candidates.push(sibling);
      }
      if (parent === document.body) break;
      branch = parent;
      parent = branch.parentElement;
    }
  }
  for (const element of candidates) {
    if (!isolatedBodyChildren.has(element)) isolatedBodyChildren.set(element, acquireInert(element));
  }
  for (const [element, release] of isolatedBodyChildren) {
    if (candidates.includes(element)) continue;
    release();
    isolatedBodyChildren.delete(element);
  }
}

export function useModalIsolation(
  active: boolean,
  id: string,
  rootRef: RefObject<HTMLElement | null>,
  lockBodyScroll = true,
  revision = 0,
): void {
  useBodyScrollLock(active && lockBodyScroll);
  useEffect(() => {
    if (!active) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    modalRoots.set(id, root);
    if (modalRoots.size === 1) {
      isolationObserver = new MutationObserver(refreshModalIsolation);
      isolationObserver.observe(document.body, { childList: true, subtree: true });
    }
    refreshModalIsolation();
    return () => {
      modalRoots.delete(id);
      refreshModalIsolation();
      if (modalRoots.size !== 0) return;
      isolationObserver?.disconnect();
      isolationObserver = undefined;
      isolatedBodyChildren.forEach((release) => release());
      isolatedBodyChildren.clear();
    };
  }, [active, id, revision, rootRef]);
}

export function syncPortalContext(source: Element | null, target: HTMLElement | null): void {
  if (!source || !target) return;
  const theme = source.closest<HTMLElement>('[data-cg-theme]')?.dataset.cgTheme;
  const density = source.closest<HTMLElement>('[data-cg-density]')?.dataset.cgDensity;
  const direction = getComputedStyle(source).direction;
  if (theme && target.dataset.cgTheme !== theme) target.dataset.cgTheme = theme;
  else if (!theme && target.dataset.cgTheme !== undefined) delete target.dataset.cgTheme;
  if (density && target.dataset.cgDensity !== density) target.dataset.cgDensity = density;
  else if (!density && target.dataset.cgDensity !== undefined) delete target.dataset.cgDensity;
  if ((direction === 'ltr' || direction === 'rtl') && target.dir !== direction) target.dir = direction;
}

export function usePortalContext(
  active: boolean,
  sourceRef: RefObject<Element | null>,
  targetRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const update = () => syncPortalContext(sourceRef.current, targetRef.current);
    update();
    const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update);
    observer?.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-cg-theme', 'data-cg-density', 'dir'],
    });
    return () => observer?.disconnect();
  }, [active, sourceRef, targetRef]);
}

export function useFocusOrigin(active: boolean): RefObject<HTMLElement | null> {
  const originRef = useRef<HTMLElement | null>(null);
  const interactionRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);
  useLayoutEffect(() => {
    if (active && !wasActiveRef.current) {
      const focused = document.activeElement instanceof HTMLElement
        && document.activeElement !== document.body
        && document.activeElement !== document.documentElement
        ? document.activeElement
        : null;
      originRef.current = focused ?? (interactionRef.current?.isConnected ? interactionRef.current : null);
      interactionRef.current = null;
    }
    wasActiveRef.current = active;
    if (active) return undefined;
    const rememberInteraction = (event: Event) => {
      interactionRef.current = event.target instanceof HTMLElement ? event.target : null;
    };
    document.addEventListener('pointerdown', rememberInteraction, true);
    document.addEventListener('click', rememberInteraction, true);
    return () => {
      document.removeEventListener('pointerdown', rememberInteraction, true);
      document.removeEventListener('click', rememberInteraction, true);
    };
  }, [active]);
  return originRef;
}

export function clampWindowPosition(element: HTMLElement, point: CgOverlayPoint, margin = 12): CgOverlayPoint {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const rect = element.getBoundingClientRect();
  return {
    x: Math.min(Math.max(point.x, left + margin - Math.max(0, rect.width - 120)), left + width - margin - 44),
    y: Math.min(Math.max(point.y, top + margin), top + height - margin - 44),
  };
}
