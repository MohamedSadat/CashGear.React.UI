import { forwardRef, useCallback, useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref, RefAttributes, ReactElement } from 'react';
import { useControllableState, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { awaitWithAbort } from '../../internal/awaitWithAbort';
import { CgTagBox } from '../TagBox';
import type { CgTagBoxProps, CgTagBoxValueChangeDetails } from '../TagBox';

export interface CgKeyTagBoxResolverContext<TContext = unknown> {
  readonly signal: AbortSignal;
  readonly queryContext: TContext | undefined;
  readonly dataVersion: string | number | undefined;
}
export interface CgKeyTagBoxActions { refreshSelectedItems(): Promise<void> }
export interface CgKeyTagBoxValueChangeDetails<TItem, TKey> extends Omit<CgTagBoxValueChangeDetails<TKey>, 'addedItems' | 'removedItems'> {
  readonly selectedItems: ReadonlyArray<TItem | null>;
  readonly addedKeys: ReadonlyArray<TKey>;
  readonly removedKeys: ReadonlyArray<TKey>;
}
type AdapterProps<TItem> = CgTagBoxProps<TItem> extends infer TProps ? TProps extends unknown
  ? Omit<TProps, 'value' | 'defaultValue' | 'onValueChange' | 'getOptionKey' | 'queryContext'> : never : never;
export type CgKeyTagBoxProps<TItem, TKey extends string | number, TContext = unknown> = AdapterProps<TItem> & {
  value?: ReadonlyArray<TKey>;
  defaultValue?: ReadonlyArray<TKey>;
  getOptionKey: (item: TItem) => TKey;
  queryContext?: TContext;
  isValueEqual?: (left: TKey, right: TKey) => boolean;
  getValueHash?: (key: TKey) => string | number;
  getFallbackLabel?: (key: TKey) => string;
  itemResolver?: (key: TKey, context: CgKeyTagBoxResolverContext<TContext>) => PromiseLike<TItem | null | undefined>;
  actionsRef?: Ref<CgKeyTagBoxActions>;
  onResolutionError?: (error: unknown, key: TKey, context: CgKeyTagBoxResolverContext<TContext>) => void;
  onValueChange?: (keys: ReadonlyArray<TKey>, details: CgKeyTagBoxValueChangeDetails<TItem, TKey>) => void;
};
interface Entry<TItem, TKey> { key: TKey; item: TItem | null; resolved: boolean }
const emptyKeys: readonly never[] = [];
const defaultEqual = Object.is;

function KeyTagBoxInner<TItem, TKey extends string | number, TContext = unknown>(props: CgKeyTagBoxProps<TItem, TKey, TContext>, ref: React.ForwardedRef<HTMLInputElement>) {
  const { value, defaultValue = emptyKeys, onValueChange, getOptionKey, isValueEqual = defaultEqual, getValueHash,
    getFallbackLabel = String, itemResolver, actionsRef, onResolutionError, queryContext, dataVersion,
    options, loadOptions, getOptionLabel, getOptionSearchText, isOptionDisabled, renderOption, renderTag,
    removeAriaLabel, onOptionSelected, onOptionRemoved, ...rest } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(inputRef, ref);
  const [keys, setKeys] = useControllableState<ReadonlyArray<TKey>>(value, defaultValue, 'CgKeyTagBox');
  const [, refresh] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const cache = useMemo(() => {
    const buckets = new Map<string | number, Array<Entry<TItem, TKey>>>();
    return {
      entry(key: TKey) {
        // Without a host hash, a single bucket also supports arbitrary equality.
        const hash = getValueHash?.(key) ?? (isValueEqual === defaultEqual ? `${typeof key}:${String(key)}` : 0);
        const bucket = buckets.get(hash) ?? [];
        let result = bucket.find((candidate) => isValueEqual(candidate.key, key));
        if (!result) { result = { key, item: null, resolved: false }; bucket.push(result); buckets.set(hash, bucket); }
        return result;
      },
    };
  // A changed owner must never reuse a previous tenant's selected labels or failures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryContext, dataVersion, itemResolver, getOptionKey, isValueEqual, getValueHash]);
  const wrap = useCallback((item: TItem) => {
    const entry = cache.entry(getOptionKey(item));
    entry.item = item;
    entry.resolved = true;
    return entry;
  }, [cache, getOptionKey]);
  const local = useMemo(() => options?.map(wrap), [options, wrap]);
  const selected = keys.map((key) => cache.entry(key));
  const keySignature = JSON.stringify(keys);
  const resolve = useStableCallback(async (force = false) => {
    controller.current?.abort();
    const operation = new AbortController();
    controller.current = operation;
    const context = Object.freeze({ signal: operation.signal, queryContext, dataVersion });
    if (!itemResolver) return;
    await Promise.all(keys.map(async (key) => {
      const entry = cache.entry(key);
      if (entry.resolved && !force) return;
      try {
        const item = await awaitWithAbort(itemResolver(key, context), operation.signal);
        if (operation.signal.aborted || controller.current !== operation) return;
        if (item != null && !isValueEqual(getOptionKey(item), key)) throw new Error('CgKeyTagBox resolver returned a mismatched key.');
        entry.item = item ?? null;
        entry.resolved = true;
      } catch (error) {
        if (operation.signal.aborted || controller.current !== operation) return;
        entry.item = null;
        entry.resolved = true;
        onResolutionError?.(error, key, context);
      }
    }));
    if (!operation.signal.aborted && controller.current === operation) refresh((previous) => previous + 1);
  });
  useLayoutEffect(() => { controller.current?.abort(); }, [cache, keySignature]);
  useEffect(() => {
    void resolve();
    return () => controller.current?.abort();
  }, [cache, keySignature, resolve]);
  useImperativeHandle(actionsRef, () => ({ refreshSelectedItems: () => resolve(true) }), [resolve]);
  const loadWrapped = useCallback(async (query: string, context: Parameters<NonNullable<typeof loadOptions>>[1]) => {
    const results = await loadOptions!(query, context);
    if (context.signal.aborted) return [];
    return results.map(wrap);
  }, [loadOptions, wrap]);
  const source = local ? { options: local } : { loadOptions: loadWrapped };
  const label = (entry: Entry<TItem, TKey>) => entry.item == null ? getFallbackLabel(entry.key) : getOptionLabel(entry.item);
  useFormReset(inputRef, () => {
    controller.current?.abort();
    if (value !== undefined) return;
    setKeys(defaultValue);
    onValueChange?.(defaultValue, { reason: 'reset', previousValue: keys,
      selectedItems: defaultValue.map((key) => cache.entry(key).item),
      addedKeys: defaultValue.filter((key) => !keys.some((previous) => isValueEqual(previous, key))),
      removedKeys: keys.filter((key) => !defaultValue.some((next) => isValueEqual(next, key))) });
  });
  return <CgTagBox {...rest} {...source} ref={mergedRef} queryContext={queryContext} dataVersion={dataVersion}
    value={selected} getOptionKey={(entry) => entry.key} getOptionLabel={label}
    getOptionSearchText={(entry) => entry.item == null ? label(entry) : getOptionSearchText?.(entry.item) ?? label(entry)}
    isOptionDisabled={(entry) => entry.item == null || (isOptionDisabled?.(entry.item) ?? false)}
    removeAriaLabel={removeAriaLabel ? (entry, text) => entry.item == null ? `Remove ${text}` : removeAriaLabel(entry.item, text) : undefined}
    renderOption={renderOption ? (context) => context.option.item == null ? label(context.option) : renderOption({ ...context, option: context.option.item }) : undefined}
    renderTag={renderTag ? (context) => context.item.item == null ? label(context.item) : renderTag({ ...context, item: context.item.item }) : undefined}
    onOptionSelected={(entry) => { if (entry.item != null) onOptionSelected?.(entry.item); }}
    onOptionRemoved={(entry) => { if (entry.item != null) onOptionRemoved?.(entry.item); }}
    onValueChange={(entries, details) => {
      const next = Object.freeze(entries.map((entry) => entry.key));
      setKeys(next);
      onValueChange?.(next, { reason: details.reason, event: details.event, previousValue: Object.freeze([...keys]),
        selectedItems: Object.freeze(entries.map((entry) => entry.item)),
        addedKeys: Object.freeze(details.addedItems.map((entry) => entry.key)), removedKeys: Object.freeze(details.removedItems.map((entry) => entry.key)) });
    }} />;
}
export const CgKeyTagBox = forwardRef(KeyTagBoxInner) as <TItem, TKey extends string | number, TContext = unknown>(props: CgKeyTagBoxProps<TItem, TKey, TContext> & RefAttributes<HTMLInputElement>) => ReactElement;
