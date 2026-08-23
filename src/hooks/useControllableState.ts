import { useCallback, useState } from 'react';

/** Setter accepted by {@link useControllableState}: a value or an updater. */
export type CgStateUpdater<T> = T | ((current: T) => T);

/**
 * Supports the controlled/uncontrolled duality that every data-entry control
 * in this library must offer.
 *
 * A control is *controlled* when the consumer passes `value`; the hook then
 * echoes that value back and never stores anything, so the consumer stays the
 * single source of truth. It is *uncontrolled* when only `defaultValue` is
 * passed; the hook then owns the state.
 *
 * Centralising the rule here keeps `CgTextBox`, and every future `CgComboBox`
 * or `CgGrid`, behaving identically instead of each re-deriving it.
 *
 * @param controlledValue The `value` prop, or `undefined` when uncontrolled.
 * @param defaultValue    Initial value, used only in uncontrolled mode.
 * @returns A `[value, setValue]` pair. In controlled mode `setValue` is a
 *          deliberate no-op — the owner applies the change.
 */
export function useControllableState<T>(
  controlledValue: T | undefined,
  defaultValue: T,
): [T, (next: CgStateUpdater<T>) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState<T>(defaultValue);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const setValue = useCallback(
    (next: CgStateUpdater<T>) => {
      // In controlled mode the owner is responsible for the new value; writing
      // to local state here would create a second source of truth.
      if (isControlled) return;

      // Always use the updater form so the change resolves against the freshest
      // state, and so a `T` that is itself a function is stored, not invoked.
      setUncontrolledValue((current) =>
        typeof next === 'function' ? (next as (current: T) => T)(current) : next,
      );
    },
    [isControlled],
  );

  return [value, setValue];
}
