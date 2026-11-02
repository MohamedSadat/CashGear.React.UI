import { forwardRef, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { useControllableState, useDirection, useMergedRefs } from '../../hooks';
import { useFieldControl } from '../../internal';
import { assertFinite, assertPositive } from '../../internal/validation';
import { cx } from '../../utils';
import styles from './CgSlider.module.css';
import type { CgSliderProps } from './CgSlider.types';
import { clampSliderValue, snapSliderValue, stepSliderValue } from './sliderValue';

type SliderStyle = CSSProperties & Record<`--cg-slider-${string}`, string>;

interface SliderGesture {
  readonly pointerId: number;
  /** Distance from the pointer to the thumb's centre, so pressing the thumb never moves it. */
  readonly offset: number;
  readonly startValue: number;
  lastValue: number;
}

const PAGE_STEPS = 10;

function preventFocusLoss(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export const CgSlider = forwardRef<HTMLDivElement, CgSliderProps>(function CgSlider(
  { value, defaultValue, min = 0, max = 100, step = 1, onValueChange, onValueCommit, disabled, size = 'medium', direction = 'auto', ariaLabel, formatValue, marks, showSteppers = false, stepperStep, decreaseLabel = 'Decrease', increaseLabel = 'Increase', className, style, 'aria-label': nativeAriaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, ...nativeProps },
  forwardedRef,
) {
  assertFinite('min', min);
  assertFinite('max', max);
  assertFinite('value', value);
  assertFinite('defaultValue', defaultValue);
  if (max <= min) throw new RangeError('CgSlider max must be greater than min.');
  assertPositive('step', step);
  if (stepperStep !== undefined) assertPositive('stepperStep', stepperStep);

  const field = useFieldControl({ disabled, ariaLabel: ariaLabel ?? nativeAriaLabel, labelledBy: ariaLabelledBy, describedBy: ariaDescribedBy });
  const [state, setState] = useControllableState(value, defaultValue ?? min, 'CgSlider');
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const thumbRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<SliderGesture | null>(null);
  const resolvedDirection = useDirection(rootRef, direction);
  const range = { min, max, step };
  const current = clampSliderValue(state, range);

  /** A complete change in one action, so it is also its own commit. */
  const applyValue = (next: number) => {
    if (next === current) return;
    setState(next);
    onValueChange?.(next);
    onValueCommit?.(next);
  };

  const proposeDrag = (next: number, gesture: SliderGesture) => {
    if (next === gesture.lastValue) return;
    gesture.lastValue = next;
    setState(next);
    onValueChange?.(next);
  };

  const valueAtPointer = (track: HTMLElement, clientX: number) => {
    const { left, width } = track.getBoundingClientRect();
    const position = width > 0 ? Math.min(1, Math.max(0, (clientX - left) / width)) : 0;
    return snapSliderValue(min + (resolvedDirection === 'rtl' ? 1 - position : position) * (max - min), range);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (field.disabled || event.button !== 0) return;
    const thumb = thumbRef.current;
    const onThumb = thumb !== null && event.target instanceof Node && thumb.contains(event.target);
    let offset = 0;
    if (onThumb) {
      const { left, width } = thumb.getBoundingClientRect();
      offset = event.clientX - (left + width / 2);
    }
    const gesture: SliderGesture = { pointerId: event.pointerId, offset, startValue: current, lastValue: current };
    gestureRef.current = gesture;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Unsupported capture is nonfatal. */ }
    thumb?.focus({ preventScroll: true });
    if (!onThumb) proposeDrag(valueAtPointer(event.currentTarget, event.clientX), gesture);
  };

  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (field.disabled || !gesture || gesture.pointerId !== event.pointerId) return;
    proposeDrag(valueAtPointer(event.currentTarget, event.clientX - gesture.offset), gesture);
  };

  const finishGesture = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (!field.disabled && gesture.lastValue !== gesture.startValue) onValueCommit?.(gesture.lastValue);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    // With no button held the release never arrived, so the drag ended at its last position.
    if (event.buttons === 0) finishGesture(event);
    else followPointer(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    followPointer(event);
    finishGesture(event);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (gesture.lastValue === gesture.startValue) return;
    setState(gesture.startValue);
    onValueChange?.(gesture.startValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (field.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const forward = resolvedDirection === 'rtl' ? -1 : 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = stepSliderValue(current, forward, range); break;
      case 'ArrowLeft': next = stepSliderValue(current, -forward, range); break;
      case 'ArrowUp': next = stepSliderValue(current, 1, range); break;
      case 'ArrowDown': next = stepSliderValue(current, -1, range); break;
      case 'PageUp': next = stepSliderValue(current, PAGE_STEPS, range); break;
      case 'PageDown': next = stepSliderValue(current, -PAGE_STEPS, range); break;
      case 'Home': next = min; break;
      case 'End': next = max; break;
      default: return;
    }
    event.preventDefault();
    applyValue(next);
  };

  const handleStepperClick = (event: MouseEvent<HTMLButtonElement>, sign: 1 | -1) => {
    const next = snapSliderValue(current + sign * Math.max(stepperStep ?? step, step), range);
    // The stepper disables itself at the limit, so focus moves on rather than dropping to the page.
    if (next === (sign > 0 ? max : min) && document.activeElement === event.currentTarget) thumbRef.current?.focus({ preventScroll: true });
    applyValue(next);
  };

  const percent = ((current - min) / (max - min)) * 100;
  const visibleMarks = [...new Set(marks)].filter((mark) => mark >= min && mark <= max);
  const rootStyle: SliderStyle = { ...style, '--cg-slider-percent': `${percent}%` };

  return (
    <div
      {...nativeProps}
      ref={mergedRef}
      dir={direction === 'auto' ? undefined : direction}
      className={cx(styles.root, className)}
      style={rootStyle}
      data-cg-slider=""
      data-size={size}
      data-disabled={field.disabled || undefined}
    >
      {showSteppers ? (
        <button type="button" className={styles.stepper} data-cg-slider-stepper="decrease" aria-label={decreaseLabel} title={decreaseLabel} disabled={field.disabled || current <= min} onMouseDown={preventFocusLoss} onClick={(event) => handleStepperClick(event, -1)}>
          <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 6h8" /></svg>
        </button>
      ) : null}
      <div className={styles.track} data-cg-slider-track="" onMouseDown={preventFocusLoss} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onLostPointerCapture={finishGesture}>
        <div className={styles.rail} aria-hidden="true"><div className={styles.fill} /></div>
        {visibleMarks.map((mark) => <span key={mark} className={styles.mark} aria-hidden="true" data-cg-slider-mark={mark} style={{ '--cg-slider-mark-position': `${((mark - min) / (max - min)) * 100}%` } as SliderStyle} />)}
        <div
          ref={thumbRef}
          className={styles.thumb}
          role="slider"
          tabIndex={field.disabled ? -1 : 0}
          aria-label={field.ariaLabel ?? (field.labelledBy ? undefined : 'Value')}
          aria-labelledby={field.labelledBy}
          aria-describedby={field.describedBy}
          aria-orientation="horizontal"
          aria-disabled={field.disabled || undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-valuetext={formatValue?.(current)}
          data-cg-slider-thumb=""
          onKeyDown={handleKeyDown}
        />
      </div>
      {showSteppers ? (
        <button type="button" className={styles.stepper} data-cg-slider-stepper="increase" aria-label={increaseLabel} title={increaseLabel} disabled={field.disabled || current >= max} onMouseDown={preventFocusLoss} onClick={(event) => handleStepperClick(event, 1)}>
          <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 6h8M6 2v8" /></svg>
        </button>
      ) : null}
    </div>
  );
});
