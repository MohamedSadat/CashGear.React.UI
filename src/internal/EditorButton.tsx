import { useEffect, useRef, useState } from 'react';
import type { CgEditorButtonDescriptor } from '../types';
import { isPromiseLike } from './async';
import { renderIcon } from './icons';
import styles from './EditorButton.module.css';

export interface EditorButtonProps<TValue> {
  descriptor: CgEditorButtonDescriptor<TValue>;
  value: TValue;
  disabled?: boolean;
}

export function EditorButton<TValue>({ descriptor, value, disabled }: EditorButtonProps<TValue>) {
  const [pending, setPending] = useState(false);
  const pendingCountRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);
  if (descriptor.visible === false) return null;
  const duplicateDisabled = descriptor.preventDuplicateClicks !== false && pending;
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={descriptor.ariaLabel}
      aria-busy={pending || undefined}
      title={descriptor.title}
      disabled={disabled || descriptor.disabled || duplicateDisabled}
      onMouseDown={(event) => {
        if (descriptor.preventFocusLoss !== false) event.preventDefault();
      }}
      onClick={(event) => {
        if (descriptor.preventDuplicateClicks !== false && pendingCountRef.current > 0) return;
        const result = descriptor.onPress?.({ value, event });
        if (isPromiseLike(result)) {
          pendingCountRef.current += 1;
          setPending(true);
          void Promise.resolve(result).then(
            () => {
              pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
              if (mountedRef.current && pendingCountRef.current === 0) setPending(false);
            },
            () => {
              pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
              if (mountedRef.current && pendingCountRef.current === 0) setPending(false);
            },
          );
        }
      }}
    >
      {renderIcon(descriptor.icon)}
      {descriptor.text ? <span>{descriptor.text}</span> : null}
    </button>
  );
}
