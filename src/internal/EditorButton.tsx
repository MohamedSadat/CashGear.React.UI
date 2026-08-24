import { useState } from 'react';
import type { CgEditorButtonDescriptor } from '../types';
import { renderIcon } from './icons';
import styles from './EditorButton.module.css';

export interface EditorButtonProps<TValue> {
  descriptor: CgEditorButtonDescriptor<TValue>;
  value: TValue;
  disabled?: boolean;
}

export function EditorButton<TValue>({ descriptor, value, disabled }: EditorButtonProps<TValue>) {
  const [pending, setPending] = useState(false);
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
        const result = descriptor.onPress?.({ value, event });
        if (result instanceof Promise) {
          setPending(true);
          void result.finally(() => setPending(false));
        }
      }}
    >
      {renderIcon(descriptor.icon)}
      {descriptor.text ? <span>{descriptor.text}</span> : null}
    </button>
  );
}
