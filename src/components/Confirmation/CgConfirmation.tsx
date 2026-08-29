import { createContext, isValidElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CgButton } from '../Button';
import { CgPopup } from '../Popup';
import type { CgPopupActions } from '../Popup';
import { renderIcon } from '../../internal';
import { cx } from '../../utils';
import styles from './CgConfirmation.module.css';
import type {
  CgConfirmationApi, CgConfirmationConfirm, CgConfirmationOptions, CgConfirmationProviderProps,
} from './CgConfirmation.types';

interface ConfirmationRequest {
  id: number;
  options: Required<Pick<CgConfirmationOptions,
    'confirmLabel' | 'cancelLabel' | 'confirmIntent' | 'cancelIntent' | 'confirmAppearance' | 'cancelAppearance'
    | 'width' | 'closeOnEscape' | 'closeOnOutsideClick' | 'showCloseButton' | 'initialFocus'>> & CgConfirmationOptions;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
  settled: boolean;
  returnFocus: HTMLElement | null;
  removeAbort?: () => void;
}

const ConfirmationContext = createContext<CgConfirmationApi | null>(null);

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('The confirmation was aborted.', 'AbortError');
  const error = new Error('The confirmation was aborted.'); error.name = 'AbortError'; return error;
}

function isOptions(value: React.ReactNode | CgConfirmationOptions): value is CgConfirmationOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isValidElement(value) && 'content' in value;
}

function focusableInteractionTarget(target: EventTarget | null | undefined): HTMLElement | null {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return null;
  const candidate = target.closest('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement) return candidate;
  return typeof HTMLElement !== 'undefined' && target instanceof HTMLElement ? target : null;
}

export function CgConfirmationProvider({ children, defaults, subscribeToNavigation }: CgConfirmationProviderProps) {
  const queueRef = useRef<ConfirmationRequest[]>([]);
  const sequenceRef = useRef(0);
  const popupActionsRef = useRef<CgPopupActions>(null);
  const interactionTargetRef = useRef<HTMLElement | null>(null);
  const pendingFocusRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const lifecycleRef = useRef(0);
  const [current, setCurrent] = useState<ConfirmationRequest>();

  const settle = useMemo(() => (request: ConfirmationRequest, result: boolean, rejection?: unknown, restoreFocus = true): boolean => {
    if (request.settled) return false;
    const index = queueRef.current.indexOf(request);
    if (index < 0) return false;
    const wasActive = index === 0;
    request.settled = true; queueRef.current.splice(index, 1); request.removeAbort?.();
    if (rejection !== undefined) request.reject(rejection); else request.resolve(result);
    const next = queueRef.current[0];
    if (mountedRef.current) setCurrent(next);
    if (restoreFocus && wasActive && !next && request.returnFocus?.isConnected) {
      pendingFocusRef.current = request.returnFocus;
      const restoreWhenReleased = () => {
        const target = request.returnFocus;
        if (!mountedRef.current || !target?.isConnected || queueRef.current.length > 0 || typeof document === 'undefined') return;
        const active = document.activeElement;
        if (active === document.body || active === document.documentElement || !active?.isConnected || active === target) {
          target.focus({ preventScroll: true });
        }
      };
      setTimeout(restoreWhenReleased, 0);
      setTimeout(restoreWhenReleased, 100);
    }
    return true;
  }, []);

  const settleAll = useMemo(() => (result: boolean, rejection?: unknown) => {
    const pending = [...queueRef.current]; pending.forEach((request) => settle(request, result, rejection, false));
  }, [settle]);

  const confirm = useMemo<CgConfirmationConfirm>(() => ((messageOrOptions: React.ReactNode | CgConfirmationOptions): Promise<boolean> => {
    if (!mountedRef.current) return Promise.reject(new Error('CgConfirmationProvider is no longer mounted.'));
    const supplied = isOptions(messageOrOptions) ? messageOrOptions : { content: messageOrOptions };
    if (supplied.content === null || supplied.content === undefined) return Promise.reject(new Error('CgConfirmation confirm requires content.'));
    if (supplied.signal?.aborted) return Promise.reject(abortError());
    const resolved: ConfirmationRequest['options'] = {
      ...defaults, ...supplied,
      confirmLabel: supplied.confirmLabel ?? defaults?.confirmLabel ?? 'Confirm',
      cancelLabel: supplied.cancelLabel ?? defaults?.cancelLabel ?? 'Cancel',
      confirmIntent: supplied.confirmIntent ?? defaults?.confirmIntent ?? 'primary',
      cancelIntent: supplied.cancelIntent ?? defaults?.cancelIntent ?? 'secondary',
      confirmAppearance: supplied.confirmAppearance ?? defaults?.confirmAppearance ?? 'solid',
      cancelAppearance: supplied.cancelAppearance ?? defaults?.cancelAppearance ?? 'solid',
      width: supplied.width ?? defaults?.width ?? '420px',
      closeOnEscape: supplied.closeOnEscape ?? defaults?.closeOnEscape ?? true,
      closeOnOutsideClick: supplied.closeOnOutsideClick ?? defaults?.closeOnOutsideClick ?? false,
      showCloseButton: supplied.showCloseButton ?? defaults?.showCloseButton ?? true,
      initialFocus: supplied.initialFocus ?? defaults?.initialFocus ?? 'cancel',
    };
    return new Promise<boolean>((resolve, reject) => {
      const focusedElement = typeof document !== 'undefined' && typeof HTMLElement !== 'undefined'
        && document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
      const dispatchedTarget = typeof window !== 'undefined' ? focusableInteractionTarget(window.event?.target) : null;
      const returnFocus = focusedElement
        ?? (interactionTargetRef.current?.isConnected ? interactionTargetRef.current : null)
        ?? dispatchedTarget;
      const request: ConfirmationRequest = { id: ++sequenceRef.current, options: resolved, resolve, reject, settled: false, returnFocus };
      if (supplied.signal) {
        const onAbort = () => settle(request, false, abortError());
        supplied.signal.addEventListener('abort', onAbort, { once: true });
        request.removeAbort = () => supplied.signal?.removeEventListener('abort', onAbort);
      }
      pendingFocusRef.current = null;
      queueRef.current.push(request); if (mountedRef.current) setCurrent((active) => active ?? request);
    });
  }) as CgConfirmationConfirm, [defaults, settle]);

  const api = useMemo<CgConfirmationApi>(() => ({ confirm }), [confirm]);
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const rememberInteraction = (event: Event) => {
      const target = focusableInteractionTarget(event.target);
      interactionTargetRef.current = target;
      queueMicrotask(() => {
        if (interactionTargetRef.current === target) interactionTargetRef.current = null;
      });
    };
    document.addEventListener('pointerdown', rememberInteraction, true);
    document.addEventListener('click', rememberInteraction, true);
    return () => {
      document.removeEventListener('pointerdown', rememberInteraction, true);
      document.removeEventListener('click', rememberInteraction, true);
    };
  }, []);
  useEffect(() => {
    if (!current) return;
    queueMicrotask(() => popupActionsRef.current?.focus());
  }, [current]);
  useEffect(() => {
    if (!subscribeToNavigation) return undefined;
    const cleanup = subscribeToNavigation(() => settleAll(false));
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [settleAll, subscribeToNavigation]);
  /* The generation ref is intentionally sampled again in deferred cleanup so
     Strict Mode's setup-cleanup-setup replay can supersede the first cleanup. */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    mountedRef.current = true; const setupGeneration = ++lifecycleRef.current;
    return () => {
      mountedRef.current = false; const cleanupGeneration = ++lifecycleRef.current;
      queueMicrotask(() => {
        if (!mountedRef.current && lifecycleRef.current === cleanupGeneration && cleanupGeneration > setupGeneration) {
          settleAll(false, new Error('CgConfirmationProvider unmounted before pending confirmations completed.'));
        }
      });
    };
  }, [settleAll]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const options = current?.options;
  const messageId = current ? `cg-confirmation-message-${current.id}` : undefined;
  return <ConfirmationContext.Provider value={api}>{children}<CgPopup
    open={Boolean(current)} actionsRef={popupActionsRef} role="alertdialog" header={options?.title ?? defaults?.title ?? 'Confirm'}
    showHeader showFooter showCloseButton={options?.showCloseButton ?? true} closeOnEscape={options?.closeOnEscape ?? true}
    closeOnOutsideClick={options?.closeOnOutsideClick ?? false} width={options?.width ?? '420px'} className={cx(styles.popup, options?.className)}
    aria-describedby={messageId} contentLoadMode="fromMount"
    onAfterClose={() => {
      const target = pendingFocusRef.current;
      pendingFocusRef.current = null;
      setTimeout(() => {
        if (mountedRef.current && target?.isConnected) target.focus({ preventScroll: true });
      }, 0);
    }}
    onOpenChange={(nextOpen) => { if (!nextOpen && current) settle(current, false); }}
    body={current ? <div className={styles.content}>{options?.renderIcon || options?.icon ? <span className={styles.icon} aria-hidden="true">{options.renderIcon ? options.renderIcon() : options.icon ? renderIcon(options.icon) : null}</span> : null}<div id={messageId} className={styles.message}>{options?.content}</div></div> : null}
    footer={current ? <div className={styles.actions}><CgButton intent={options?.cancelIntent} appearance={options?.cancelAppearance} data-cg-autofocus={options?.initialFocus === 'cancel' ? '' : undefined} onClick={() => { settle(current, false); }}>{options?.cancelLabel}</CgButton><CgButton intent={options?.confirmIntent} appearance={options?.confirmAppearance} data-cg-autofocus={options?.initialFocus === 'confirm' ? '' : undefined} onClick={() => { settle(current, true); }}>{options?.confirmLabel}</CgButton></div> : null}
  /></ConfirmationContext.Provider>;
}

export function useCgConfirmation(): CgConfirmationApi {
  const value = useContext(ConfirmationContext);
  if (!value) throw new Error('useCgConfirmation must be used inside CgConfirmationProvider.');
  return value;
}
