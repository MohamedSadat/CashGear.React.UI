import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useControllableState, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { CgComboBox } from '../ComboBox';
import type { CgComboBoxProps, CgComboBoxValueChangeDetails } from '../ComboBox';
import type { CgKeyComboBoxActions, CgKeyComboBoxProps, CgKeyComboBoxValueChangeDetails } from './CgKeyComboBox.types';

interface ResolverAttempt<TItem, TValue, TContext> {
  readonly value: TValue;
  readonly queryContext: TContext | undefined;
  readonly dataVersion: unknown;
  readonly item: TItem | null;
  readonly error?: unknown;
}

const ComboBoxWithFallback = CgComboBox as <TItem, TContext = unknown>(
  props: CgComboBoxProps<TItem, TContext> & React.RefAttributes<HTMLInputElement> & {
    readonly _unresolvedValueText?: string;
    readonly _serializedValue?: string;
    readonly _suppressFormReset?: boolean;
  },
) => React.ReactElement;

function CgKeyComboBoxInner<TItem, TValue extends string | number, TContext>(
  {
    value,
    defaultValue,
    onValueChange,
    getOptionKey,
    selectedItem = null,
    isValueEqual = Object.is,
    itemResolver,
    actionsRef,
    resolutionErrorMessage = 'Unable to resolve the selected item.',
    onResolutionError,
    options,
    loadOptions,
    queryContext,
    isQueryContextEqual = Object.is,
    dataVersion,
    name,
    form,
    disabled,
    ...comboBoxProps
  }: CgKeyComboBoxProps<TItem, TValue, TContext>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  if (options !== undefined && loadOptions !== undefined) throw new Error('CgKeyComboBox accepts either options or loadOptions, not both.');

  const [keyValue, setKeyValue] = useControllableState<TValue | null>(value, defaultValue ?? null, 'CgKeyComboBox');
  const [lastSelectedItem, setLastSelectedItem] = useState<TItem | null>(null);
  const [resolvedItem, setResolvedItem] = useState<TItem | null>(null);
  const [resolutionError, setResolutionError] = useState<unknown>();
  const [resolutionRevision, setResolutionRevision] = useState(0);
  const attemptsRef = useRef<Array<ResolverAttempt<TItem, TValue, TContext>>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(inputRef, forwardedRef);
  const resolverAbortRef = useRef<AbortController | null>(null);
  const keyValueRef = useRef(keyValue);
  const onResolutionErrorRef = useRef(onResolutionError);
  const isQueryContextEqualRef = useRef(isQueryContextEqual);
  const getOptionKeyStable = useStableCallback(getOptionKey);
  const isValueEqualStable = useStableCallback(isValueEqual);
  const resolverStable = useStableCallback(itemResolver);
  const resolverAvailable = itemResolver !== undefined;

  useLayoutEffect(() => { keyValueRef.current = keyValue; }, [keyValue]);
  useLayoutEffect(() => { onResolutionErrorRef.current = onResolutionError; }, [onResolutionError]);
  useLayoutEffect(() => { isQueryContextEqualRef.current = isQueryContextEqual; }, [isQueryContextEqual]);

  const synchronousItem = useMemo(() => {
    void dataVersion;
    if (keyValue === null) return null;
    if (selectedItem !== null && isValueEqualStable(getOptionKeyStable(selectedItem), keyValue)) return selectedItem;
    const localMatch = options?.find((option) => isValueEqualStable(getOptionKeyStable(option), keyValue));
    if (localMatch !== undefined) return localMatch;
    if (lastSelectedItem !== null && isValueEqualStable(getOptionKeyStable(lastSelectedItem), keyValue)) return lastSelectedItem;
    return null;
  }, [dataVersion, getOptionKeyStable, isValueEqualStable, keyValue, lastSelectedItem, options, selectedItem]);

  useEffect(() => {
    resolverAbortRef.current?.abort();
    resolverAbortRef.current = null;
    let active = true;
    const applyResolution = (item: TItem | null, error?: unknown) => {
      queueMicrotask(() => {
        if (!active) return;
        setResolvedItem(item);
        setResolutionError(error);
      });
    };
    if (keyValue === null || synchronousItem !== null || !resolverAvailable) {
      applyResolution(null);
      return () => { active = false; };
    }

    const cached = attemptsRef.current.find((attempt) =>
      isValueEqualStable(attempt.value, keyValue)
      && Object.is(attempt.dataVersion, dataVersion)
      && isQueryContextEqualRef.current(attempt.queryContext as TContext, queryContext as TContext));
    if (cached) {
      applyResolution(cached.item, cached.error);
      return () => { active = false; };
    }

    const controller = new AbortController();
    resolverAbortRef.current = controller;
    applyResolution(null);
    void Promise.resolve(resolverStable(keyValue, { signal: controller.signal, queryContext: queryContext as TContext })).then(
      (item) => {
        if (controller.signal.aborted) return;
        let error: unknown;
        let accepted = item ?? null;
        if (accepted !== null && !isValueEqualStable(getOptionKeyStable(accepted), keyValue)) {
          error = new Error('CgKeyComboBox itemResolver returned an item with a different key.');
          accepted = null;
        }
        attemptsRef.current.push({ value: keyValue, queryContext, dataVersion, item: accepted, ...(error === undefined ? {} : { error }) });
        setResolvedItem(accepted);
        setResolutionError(error);
        if (error !== undefined) {
          try { onResolutionErrorRef.current?.({ error, value: keyValue, queryContext }); } catch { /* diagnostics must not alter control behavior */ }
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        attemptsRef.current.push({ value: keyValue, queryContext, dataVersion, item: null, error });
        setResolvedItem(null);
        setResolutionError(error);
        try { onResolutionErrorRef.current?.({ error, value: keyValue, queryContext }); } catch { /* diagnostics must not alter control behavior */ }
      },
    );
    return () => { active = false; controller.abort(); };
  }, [dataVersion, getOptionKeyStable, isValueEqualStable, keyValue, queryContext, resolutionRevision, resolverAvailable, resolverStable, synchronousItem]);

  useEffect(() => () => resolverAbortRef.current?.abort(), []);

  useImperativeHandle(actionsRef, (): CgKeyComboBoxActions => ({
    refreshSelectedItem() {
      resolverAbortRef.current?.abort();
      const current = keyValueRef.current;
      if (current !== null) attemptsRef.current = attemptsRef.current.filter((attempt) => !isValueEqualStable(attempt.value, current));
      setResolutionRevision((revision) => revision + 1);
      return Promise.resolve();
    },
  }), [isValueEqualStable]);

  const itemValue = synchronousItem ?? resolvedItem;
  useFormReset(inputRef, () => {
    if (value !== undefined) return;
    const previousValue = keyValueRef.current;
    const nextValue = defaultValue ?? null;
    const nextItem = nextValue === null ? null : options?.find((option) => isValueEqualStable(getOptionKeyStable(option), nextValue)) ?? (selectedItem !== null && isValueEqualStable(getOptionKeyStable(selectedItem), nextValue) ? selectedItem : null);
    setKeyValue(nextValue);
    setLastSelectedItem(nextItem);
    onValueChange?.(nextValue, { reason: 'reset', previousValue, selectedItem: nextItem, previousSelectedItem: itemValue });
  });
  const handleValueChange = (item: TItem | null, details: CgComboBoxValueChangeDetails<TItem>) => {
    const previousValue = keyValueRef.current;
    const nextValue = item === null ? null : getOptionKey(item);
    setLastSelectedItem(item);
    setKeyValue(nextValue);
    onValueChange?.(nextValue, {
      reason: details.reason,
      previousValue,
      selectedItem: item,
      previousSelectedItem: details.previousValue,
      event: details.event,
    } satisfies CgKeyComboBoxValueChangeDetails<TItem, TValue>);
  };

  const sharedProps = {
    ...comboBoxProps,
    queryContext,
    isQueryContextEqual,
    dataVersion,
    value: itemValue,
    defaultValue: null,
    onValueChange: handleValueChange,
    getOptionKey,
    name,
    form,
    disabled,
    _unresolvedValueText: keyValue === null || itemValue !== null ? undefined : String(keyValue),
    _serializedValue: keyValue === null ? '' : String(keyValue),
    _suppressFormReset: true,
  };

  const combo = loadOptions !== undefined
    ? <ComboBoxWithFallback {...sharedProps} ref={mergedRef} loadOptions={loadOptions} />
    : <ComboBoxWithFallback {...sharedProps} ref={mergedRef} options={options} />;

  return (
    <>
      {combo}
      {resolutionError !== undefined ? <div role="alert">{resolutionErrorMessage}</div> : null}
    </>
  );
}

export const CgKeyComboBox = forwardRef(CgKeyComboBoxInner) as <TItem, TValue extends string | number, TContext = unknown>(
  props: CgKeyComboBoxProps<TItem, TValue, TContext> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
