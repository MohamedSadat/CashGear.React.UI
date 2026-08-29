import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, MouseEvent, ReactNode } from 'react';
import { CgPortal } from '../../internal';
import { cx } from '../../utils';
import styles from './CgToast.module.css';
import type {
  CgToastApi, CgToastConvenienceOptions, CgToastId, CgToastOptions, CgToastPosition,
  CgToastProviderProps, CgToastVariant,
} from './CgToast.types';

const POSITIONS: ReadonlyArray<CgToastPosition> = ['top-start', 'top-center', 'top-end', 'bottom-start', 'bottom-center', 'bottom-end'];
const EXIT_DURATION = 180;
interface ToastEntry extends Required<Pick<CgToastOptions, 'variant' | 'duration' | 'persistent' | 'showCloseButton' | 'closeButtonAriaLabel' | 'position' | 'direction' | 'suppressDuplicates'>> {
  id: CgToastId;
  content: ReactNode;
  title?: ReactNode;
  action?: CgToastOptions['action'];
  metadata?: unknown;
  className?: string;
  important: boolean;
  duplicateKey?: string;
  exiting: boolean;
  sequence: number;
}

const ToastContext = createContext<CgToastApi | null>(null);

function icon(variant: CgToastVariant): string {
  if (variant === 'success') return '✓';
  if (variant === 'error') return '×';
  if (variant === 'warning') return '!';
  if (variant === 'info') return 'i';
  return '•';
}

interface ToastItemProps {
  entry: ToastEntry;
  dismiss: (id: string) => boolean;
  onActionError?: CgToastProviderProps['onActionError'];
}

function ToastItem({ entry, dismiss, onActionError }: ToastItemProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [actionRunning, setActionRunning] = useState(false);
  const actionExecutedRef = useRef(false);
  const [actionExecuted, setActionExecuted] = useState(false);
  const mountedRef = useRef(true);
  const remainingRef = useRef(entry.duration);
  const startedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const paused = hovered || focused || documentHidden || actionRunning;

  useEffect(() => {
    const handleVisibility = () => setDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  useEffect(() => () => { mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    if (entry.persistent || entry.exiting || paused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
      }
      return undefined;
    }
    if (remainingRef.current <= 0) { dismiss(entry.id); return undefined; }
    startedRef.current = Date.now();
    timerRef.current = setTimeout(() => { timerRef.current = undefined; remainingRef.current = 0; dismiss(entry.id); }, remainingRef.current);
    return () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current); timerRef.current = undefined;
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
    };
  }, [dismiss, entry.exiting, entry.id, entry.persistent, paused]);

  const runAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!entry.action || actionExecutedRef.current || entry.exiting) return;
    actionExecutedRef.current = true; setActionExecuted(true); setActionRunning(true);
    let succeeded = false;
    try { await entry.action.onAction(); succeeded = true; }
    catch (error) {
      try { if (onActionError) onActionError(error, entry.id, entry.metadata); else console.error(`CgToast action failed for ${entry.id}.`, error); } catch { /* Error reporting is terminal. */ }
    }
    if (!mountedRef.current) return;
    setActionRunning(false);
    if (succeeded && (entry.action.dismissOnAction ?? true)) dismiss(entry.id);
  };
  const alert = entry.variant === 'error' || entry.important;
  return <article
    className={cx(styles.toast, styles[entry.variant], entry.exiting && styles.exiting, entry.className)}
    role={alert ? 'alert' : 'status'} aria-live={alert ? 'assertive' : 'polite'} aria-atomic="true"
    aria-busy={actionRunning || undefined} dir={entry.direction === 'auto' ? undefined : entry.direction}
    data-cg-toast="" data-toast-id={entry.id} data-toast-variant={entry.variant}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}
  >
    <span className={styles.accent} aria-hidden="true" />
    <span className={styles.icon} aria-hidden="true">{icon(entry.variant)}</span>
    <div className={styles.body}>{entry.title !== undefined ? <div className={styles.title}>{entry.title}</div> : null}<div className={styles.content}>{entry.content}</div>
      {entry.action ? <button type="button" className={styles.action} disabled={actionExecuted || entry.exiting} onClick={(event) => { void runAction(event); }}>{entry.action.label}</button> : null}
    </div>
    {entry.showCloseButton ? <button type="button" className={styles.close} aria-label={entry.closeButtonAriaLabel} disabled={entry.exiting} onClick={() => dismiss(entry.id)}>×</button> : null}
    {!entry.persistent ? <span className={styles.progress} aria-hidden="true" style={{ animationDuration: `${entry.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} /> : null}
  </article>;
}

export function CgToastProvider({
  children, duration = 5000, persistent = false, showCloseButton = true,
  closeButtonAriaLabel = 'Dismiss notification', position = 'top-end', direction = 'auto',
  maximumVisible = 5, newestFirst = false, portalTarget, subscribeToNavigation, onActionError,
}: CgToastProviderProps) {
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('CgToastProvider duration must be greater than zero.');
  if (!Number.isInteger(maximumVisible) || maximumVisible <= 0) throw new RangeError('CgToastProvider maximumVisible must be a positive integer.');
  if (!POSITIONS.includes(position)) throw new Error(`CgToastProvider position "${position}" is invalid.`);
  const [entries, setEntries] = useState<ReadonlyArray<ToastEntry>>([]);
  const entriesRef = useRef<ReadonlyArray<ToastEntry>>([]);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const contextRef = useRef<HTMLSpanElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const commit = (next: ReadonlyArray<ToastEntry>) => { entriesRef.current = next; if (mountedRef.current) setEntries(next); };

  const dismiss = useMemo(() => (id: string): boolean => {
    const entry = entriesRef.current.find((candidate) => candidate.id === id);
    if (!entry || entry.exiting) return false;
    const positionEntries = entriesRef.current.filter((candidate) => candidate.position === entry.position && !candidate.exiting).sort((left, right) => left.sequence - right.sequence);
    const visible = positionEntries.slice(0, maximumVisible).some((candidate) => candidate.id === id);
    if (!visible) { commit(entriesRef.current.filter((candidate) => candidate.id !== id)); return true; }
    commit(entriesRef.current.map((candidate) => candidate.id === id ? { ...candidate, exiting: true } : candidate));
    const timer = setTimeout(() => { exitTimersRef.current.delete(id); commit(entriesRef.current.filter((candidate) => candidate.id !== id)); }, EXIT_DURATION);
    exitTimersRef.current.set(id, timer); return true;
  }, [maximumVisible]);

  const clear = useMemo(() => (variant?: CgToastVariant): number => {
    const targets = entriesRef.current.filter((entry) => variant === undefined || entry.variant === variant);
    targets.forEach((entry) => dismiss(entry.id)); return targets.length;
  }, [dismiss]);

  const show = useMemo(() => (options: CgToastOptions): CgToastId => {
    if (options.content === null || options.content === undefined) throw new Error('CgToast show requires content.');
    const resolvedVariant = options.variant ?? 'neutral';
    const resolvedPosition = options.position ?? position;
    const resolvedPersistent = options.persistent ?? persistent;
    const resolvedDuration = options.duration ?? duration;
    if (!POSITIONS.includes(resolvedPosition)) throw new Error(`CgToast position "${resolvedPosition}" is invalid.`);
    if (!resolvedPersistent && (!Number.isFinite(resolvedDuration) || resolvedDuration <= 0)) throw new RangeError('CgToast duration must be greater than zero for non-persistent messages.');
    const duplicateKey = options.duplicateKey?.trim() || undefined;
    if ((options.suppressDuplicates ?? false) && duplicateKey) {
      const existing = entriesRef.current.find((entry) => entry.duplicateKey === duplicateKey && !entry.exiting);
      if (existing) return existing.id;
    }
    if (options.action && (options.action.label === null || options.action.label === undefined || typeof options.action.onAction !== 'function')) throw new Error('CgToast action requires both label and onAction.');
    const sequence = ++sequenceRef.current;
    const id = `cg-toast-${sequence}`;
    const entry: ToastEntry = {
      id, sequence, content: options.content, variant: resolvedVariant, duration: resolvedDuration,
      persistent: resolvedPersistent, showCloseButton: options.showCloseButton ?? showCloseButton,
      closeButtonAriaLabel: options.closeButtonAriaLabel ?? closeButtonAriaLabel, position: resolvedPosition,
      direction: options.direction ?? direction, suppressDuplicates: options.suppressDuplicates ?? false,
      important: options.important ?? false, exiting: false,
      ...(options.title !== undefined ? { title: options.title } : {}), ...(options.action ? { action: options.action } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}), ...(options.className ? { className: options.className } : {}),
      ...(duplicateKey ? { duplicateKey } : {}),
    };
    commit([...entriesRef.current, entry]); return id;
  }, [closeButtonAriaLabel, direction, duration, persistent, position, showCloseButton]);

  const variantAction = useMemo(() => (variant: CgToastVariant) => (content: ReactNode, options: CgToastConvenienceOptions = {}) => show({ ...options, content, variant }), [show]);
  const api = useMemo<CgToastApi>(() => ({ show, success: variantAction('success'), error: variantAction('error'), warning: variantAction('warning'), info: variantAction('info'), dismiss, clear }), [clear, dismiss, show, variantAction]);

  useEffect(() => {
    if (!subscribeToNavigation) return undefined;
    const cleanup = subscribeToNavigation(() => { clear(); });
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [clear, subscribeToNavigation]);
  useEffect(() => () => {
    mountedRef.current = false; exitTimersRef.current.forEach((timer) => clearTimeout(timer)); exitTimersRef.current.clear(); entriesRef.current = [];
  }, []);

  useLayoutEffect(() => {
    const context = contextRef.current;
    const viewport = viewportRef.current;
    if (!context || !viewport) return;
    const themeOwner = context.closest<HTMLElement>('[data-cg-theme]');
    const densityOwner = context.closest<HTMLElement>('[data-cg-density]');
    if (themeOwner?.dataset.cgTheme) viewport.dataset.cgTheme = themeOwner.dataset.cgTheme;
    if (densityOwner?.dataset.cgDensity) viewport.dataset.cgDensity = densityOwner.dataset.cgDensity;
    viewport.dir = direction === 'auto' ? getComputedStyle(context).direction : direction;
  }, [direction]);

  return <ToastContext.Provider value={api}>{children}<span ref={contextRef} hidden aria-hidden="true" /><CgPortal target={portalTarget}>
    <div ref={viewportRef} className={styles.viewport} data-cg-toast-viewport="">{POSITIONS.map((toastPosition) => {
      const positioned = entries.filter((entry) => entry.position === toastPosition).sort((left, right) => left.sequence - right.sequence);
      const visible = positioned.filter((entry) => !entry.exiting).slice(0, maximumVisible);
      const exiting = positioned.filter((entry) => entry.exiting);
      const rendered = [...visible, ...exiting].sort((left, right) => left.sequence - right.sequence);
      if (newestFirst) rendered.reverse();
      return rendered.length ? <section key={toastPosition} className={styles.stack} data-position={toastPosition} aria-label="Notifications">
        {rendered.map((entry) => <ToastItem key={entry.id} entry={entry} dismiss={dismiss} onActionError={onActionError} />)}
      </section> : null;
    })}</div>
  </CgPortal></ToastContext.Provider>;
}

export function useCgToast(): CgToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useCgToast must be used inside CgToastProvider.');
  return value;
}
