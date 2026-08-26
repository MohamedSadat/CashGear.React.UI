/* eslint-disable react-hooks/refs -- refs hold transition and keyed collection snapshots, not visual state. */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, MouseEvent, ReactElement, RefAttributes } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { renderIcon } from '../../internal';
import { reconcileAvailableKey, stableKeyToken, validateKeyedItems } from '../../internal/keyedCollection';
import { moveRovingKey } from '../../internal/rovingFocus';
import { cx } from '../../utils';
import styles from './CgStepper.module.css';
import type { CgStepDescriptor, CgStepRenderContext, CgStepperActions, CgStepperChangeSource, CgStepperGuardDetails, CgStepperProps, CgStepperSelectionChangeDetails } from './CgStepper.types';

const DEFAULT_LABELS = { optional: 'Optional', completed: 'Completed', error: 'Contains errors', warning: 'Contains warnings', success: 'Valid', skipped: 'Skipped', disabled: 'Disabled', progress: 'Progress' };
type StepEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

function isStepAvailable<TData>(step: CgStepDescriptor<TData>): boolean {
  return !step.disabled && !step.skipped && step.selectable !== false;
}

function CgStepperInner<TData>(
  {
    steps,
    selectedKey,
    defaultSelectedKey,
    onSelectedKeyChange,
    beforeSelectionChange,
    afterSelectionChange,
    onSelectionError,
    linear = true,
    allowStepSelection = true,
    allowBackwardNavigation = true,
    allowReselectCurrentStep = false,
    selectOnFocus = false,
    orientation = 'horizontal',
    direction = 'auto',
    size = 'medium',
    showLabels = true,
    showConnectors = true,
    renderActiveContent = false,
    readOnly = false,
    labels,
    renderIndicator,
    renderLabel,
    renderConnector,
    emptyContent,
    actionsRef,
    className,
    ...nativeProps
  }: CgStepperProps<TData>,
  forwardedRef: ForwardedRef<HTMLElement>,
) {
  validateKeyedItems(steps, 'CgStepper');
  for (const step of steps) if (!step.label.trim()) throw new Error(`CgStepper step '${step.key}' requires a nonempty label.`);
  const available = useMemo(() => steps.filter(isStepAvailable), [steps]);
  const initial = defaultSelectedKey ?? available[0]?.key ?? null;
  const [stateKey, setStateKey] = useControllableState(selectedKey, initial, 'CgStepper');
  const snapshotRef = useRef({ key: stateKey, index: Math.max(0, steps.findIndex((step) => step.key === stateKey)) });
  const effectiveKey = reconcileAvailableKey(steps, stateKey, snapshotRef.current.index, isStepAvailable, 'previous-then-first');
  const effectiveIndex = steps.findIndex((step) => step.key === effectiveKey);
  const [focusedKey, setFocusedKey] = useState<string | undefined>(effectiveKey ?? available[0]?.key);
  const resolvedFocusedKey = focusedKey && available.some((step) => step.key === focusedKey) ? focusedKey : effectiveKey ?? available[0]?.key;
  const rootRef = useRef<HTMLElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const rootId = useCgId(nativeProps.id);
  const elements = useRef(new Map<string, HTMLButtonElement>());
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const operation = useAsyncOperation();
  const correctionRef = useRef<string | undefined>(undefined);
  const pendingControlled = useRef<{ details: CgStepperSelectionChangeDetails<TData>; target: string } | undefined>(undefined);
  const selectedPropRef = useRef(selectedKey);
  selectedPropRef.current = selectedKey;

  const reportError = useStableCallback((error: unknown, details: CgStepperSelectionChangeDetails<TData>) => {
    try { onSelectionError?.(error, details); } catch { /* Error reporting is terminal. */ }
  });
  const runAfter = useStableCallback(async (details: CgStepperSelectionChangeDetails<TData>) => {
    try { await afterSelectionChange?.(details); } catch (error) { reportError(error, details); }
  });

  useEffect(() => {
    const previous = snapshotRef.current;
    snapshotRef.current = { key: effectiveKey, index: effectiveIndex >= 0 ? effectiveIndex : previous.index };
    if (stateKey === effectiveKey) { correctionRef.current = undefined; return; }
    const signature = `${String(stateKey)}>${String(effectiveKey)}:${steps.map((step) => `${step.key}:${isStepAvailable(step)}`).join('|')}`;
    if (correctionRef.current === signature) return;
    correctionRef.current = signature;
    const selectedIndex = steps.findIndex((step) => step.key === effectiveKey);
    const details: CgStepperSelectionChangeDetails<TData> = {
      previousKey: stateKey,
      selectedKey: effectiveKey,
      previousIndex: previous.index,
      selectedIndex,
      source: 'collection',
      isUserInitiated: false,
      ...(selectedIndex >= 0 ? { step: steps[selectedIndex] } : {}),
    };
    setStateKey(effectiveKey);
    onSelectedKeyChange?.(effectiveKey, details);
    void runAfter(details);
  }, [effectiveIndex, effectiveKey, onSelectedKeyChange, runAfter, setStateKey, stateKey, steps]);

  useEffect(() => {
    const pending = pendingControlled.current;
    if (!pending || selectedKey !== pending.target) return;
    pendingControlled.current = undefined;
    void runAfter(pending.details);
  }, [runAfter, selectedKey]);

  const focusStep = useStableCallback((key: string) => {
    if (!available.some((step) => step.key === key)) return;
    setFocusedKey(key);
    elements.current.get(key)?.focus({ preventScroll: true });
  });

  const canReach = (targetIndex: number) => {
    if (!linear || effectiveIndex < 0 || targetIndex === effectiveIndex) return true;
    if (targetIndex < effectiveIndex) return allowBackwardNavigation;
    return steps.findIndex((step, index) => index > effectiveIndex && isStepAvailable(step)) === targetIndex;
  };

  const requestSelection = useStableCallback(async (key: string, source: CgStepperChangeSource, event?: StepEvent): Promise<boolean> => {
    const targetIndex = stepsRef.current.findIndex((step) => step.key === key);
    const target = stepsRef.current[targetIndex];
    if (!target || !isStepAvailable(target) || readOnly || !allowStepSelection || !canReach(targetIndex)) return false;
    if (key === effectiveKey && !allowReselectCurrentStep) return false;
    const previousIndex = stepsRef.current.findIndex((step) => step.key === effectiveKey);
    const previous = stepsRef.current[previousIndex];
    const base: CgStepperSelectionChangeDetails<TData> = {
      previousKey: effectiveKey,
      selectedKey: key,
      previousIndex,
      selectedIndex: targetIndex,
      source,
      isUserInitiated: source === 'pointer' || source === 'keyboard',
      ...(previous ? { previousStep: previous } : {}),
      step: target,
      ...(event ? { event } : {}),
    };
    try {
      return await operation.run(async ({ signal }) => {
        const guarded: CgStepperGuardDetails<TData> = { ...base, signal };
        if (await previous?.canLeave?.(guarded) === false || signal.aborted) return false;
        if (await target.canEnter?.(guarded) === false || signal.aborted) return false;
        if (await beforeSelectionChange?.(guarded) === false || signal.aborted) return false;
        const currentTarget = stepsRef.current.find((step) => step.key === key);
        if (currentTarget !== target || !isStepAvailable(target)) return false;
        setStateKey(key);
        onSelectedKeyChange?.(key, base);
        setFocusedKey(key);
        if (selectedKey === undefined) await runAfter(base);
        else {
          pendingControlled.current = { details: base, target: key };
          setTimeout(() => {
            const pending = pendingControlled.current;
            if (!pending || pending.target !== key || selectedPropRef.current === key) return;
            pendingControlled.current = undefined;
            if (effectiveKey) focusStep(effectiveKey);
          }, 0);
        }
        return true;
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) reportError(error, base);
      return false;
    }
  });

  const nextAvailable = useStableCallback((from: number, delta: 1 | -1) => {
    for (let index = from + delta; index >= 0 && index < steps.length; index += delta) if (isStepAvailable(steps[index]!)) return steps[index];
    return undefined;
  });
  useImperativeHandle(actionsRef, (): CgStepperActions => ({
    focus: () => { if (resolvedFocusedKey) focusStep(resolvedFocusedKey); },
    focusStep,
    selectStep: (key) => requestSelection(key, 'action'),
    next: () => { const step = nextAvailable(effectiveIndex, 1); return step ? requestSelection(step.key, 'action') : Promise.resolve(false); },
    previous: () => { const step = nextAvailable(effectiveIndex, -1); return step ? requestSelection(step.key, 'action') : Promise.resolve(false); },
  }), [effectiveIndex, focusStep, nextAvailable, requestSelection, resolvedFocusedKey]);

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    let movement: 'next' | 'previous' | 'first' | 'last' | undefined;
    if (event.key === 'Home') movement = 'first';
    else if (event.key === 'End') movement = 'last';
    else if (orientation === 'vertical' && event.key === 'ArrowDown') movement = 'next';
    else if (orientation === 'vertical' && event.key === 'ArrowUp') movement = 'previous';
    else if (orientation === 'horizontal' && event.key === 'ArrowRight') movement = resolvedDirection === 'rtl' ? 'previous' : 'next';
    else if (orientation === 'horizontal' && event.key === 'ArrowLeft') movement = resolvedDirection === 'rtl' ? 'next' : 'previous';
    if (movement) {
      event.preventDefault();
      const next = moveRovingKey(available.map((step) => step.key), key, movement);
      if (next) { focusStep(next); if (selectOnFocus) void requestSelection(next, 'keyboard', event); }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); void requestSelection(key, 'keyboard', event);
    }
  };

  if (steps.length === 0) return emptyContent === undefined ? null : <>{emptyContent}</>;
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const buttonId = (key: string) => `${rootId}-step-${stableKeyToken(key)}`;
  const activeStep = effectiveIndex >= 0 ? steps[effectiveIndex] : undefined;
  return <>
    <nav {...nativeProps} id={rootId} ref={mergedRef} dir={resolvedDirection} aria-label={nativeProps['aria-label'] ?? mergedLabels.progress} aria-busy={operation.pending || undefined} className={cx(styles.root, styles[orientation], styles[size], className)}>
      <ol className={styles.list}>
        {steps.map((step, index) => {
          const active = step.key === effectiveKey;
          const completed = step.completed ?? index < effectiveIndex;
          const availableStep = isStepAvailable(step);
          const stateText = [completed && mergedLabels.completed, step.optional && mergedLabels.optional, step.skipped && mergedLabels.skipped, step.disabled && mergedLabels.disabled, step.validationState === 'error' && mergedLabels.error, step.validationState === 'warning' && mergedLabels.warning, step.validationState === 'success' && mergedLabels.success].filter(Boolean).join(', ');
          const defaultIndicator = step.icon ? renderIcon(step.icon) : step.indicatorText ?? String(index + 1);
          const context: CgStepRenderContext<TData> = { step, index, active, focused: resolvedFocusedKey === step.key, completed, available: availableStep, defaultContent: defaultIndicator };
          const indicator = step.renderIndicator?.(context) ?? renderIndicator?.(context) ?? defaultIndicator;
          const label = step.renderLabel?.({ ...context, defaultContent: step.label }) ?? renderLabel?.({ ...context, defaultContent: step.label }) ?? step.label;
          return <li key={step.key} className={cx(styles.item, active && styles.active, completed && styles.completed, step.skipped && styles.skipped, step.disabled && styles.disabled, step.validationState && styles[step.validationState])}>
            <button
              ref={(element) => { if (element) elements.current.set(step.key, element); else elements.current.delete(step.key); }}
              id={buttonId(step.key)}
              type="button"
              className={styles.button}
              disabled={readOnly || !availableStep}
              aria-disabled={readOnly || !availableStep || undefined}
              aria-current={active ? 'step' : undefined}
              aria-describedby={stateText ? `${buttonId(step.key)}-state` : undefined}
              title={step.hint}
              tabIndex={!readOnly && availableStep && resolvedFocusedKey === step.key ? 0 : -1}
              onFocus={() => { setFocusedKey(step.key); if (selectOnFocus) void requestSelection(step.key, 'keyboard'); }}
              onClick={(event) => { void requestSelection(step.key, 'pointer', event); }}
              onKeyDown={(event) => handleKey(event, step.key)}
            >
              <span className={styles.indicator} aria-hidden="true">{indicator}<span className={styles.badge}>{step.validationState === 'error' ? '!' : step.validationState === 'success' ? '✓' : ''}</span></span>
              <span className={cx(styles.caption, !showLabels && styles.visuallyHidden)}><span className={styles.label}>{label}</span>{step.optional ? <span className={styles.meta}>{mergedLabels.optional}</span> : null}{step.description ? <span className={styles.meta}>{step.description}</span> : null}</span>
              {stateText ? <span id={`${buttonId(step.key)}-state`} className={styles.visuallyHidden}>{stateText}</span> : null}
            </button>
            {showConnectors && index < steps.length - 1 ? <span className={styles.connector} aria-hidden="true">{step.renderConnector?.({ ...context, defaultContent: null }) ?? renderConnector?.({ ...context, defaultContent: null })}</span> : null}
          </li>;
        })}
      </ol>
    </nav>
    {renderActiveContent && activeStep?.content !== undefined ? <section key={activeStep.key} className={styles.content} role="region" aria-labelledby={buttonId(activeStep.key)}>{activeStep.content}</section> : null}
  </>;
}

export const CgStepper = forwardRef(CgStepperInner) as <TData = unknown>(props: CgStepperProps<TData> & RefAttributes<HTMLElement>) => ReactElement | null;
