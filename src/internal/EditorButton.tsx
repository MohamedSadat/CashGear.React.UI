import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { CgEditorButtonDescriptor } from '../types';
import { cx } from '../utils';
import { isPromiseLike } from './async';
import { renderIcon } from './icons';
import { validateSafeUrl } from './routeMatch';
import styles from './EditorButton.module.css';

export interface EditorButtonProps<TValue> {
  descriptor: CgEditorButtonDescriptor<TValue>;
  value: TValue;
  disabled?: boolean;
}

export interface EditorButtonInteraction {
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeClick?: () => boolean;
}

export type InternalEditorButtonDescriptor<TValue> = CgEditorButtonDescriptor<TValue> & {
  interaction?: EditorButtonInteraction;
};

export function EditorButton<TValue>({ descriptor, value, disabled }: EditorButtonProps<TValue>) {
  const [pending, setPending] = useState(false);
  const pendingCountRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);
  if (descriptor.visible === false) return null;
  const interaction = (descriptor as InternalEditorButtonDescriptor<TValue>).interaction;
  const duplicateDisabled = descriptor.preventDuplicateClicks !== false && pending;
  const blocked = Boolean(disabled || descriptor.disabled || duplicateDisabled);
  const href = validateSafeUrl(descriptor.href, 'Editor button');
  const tabIndex = descriptor.focusable === false ? -1 : undefined;
  const press = (event: ReactMouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (descriptor.preventDuplicateClicks !== false && pendingCountRef.current > 0) return;
    const result = descriptor.onPress?.({ value, event });
    if (isPromiseLike(result)) {
      pendingCountRef.current += 1;
      setPending(true);
      const settle = () => {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
        if (mountedRef.current && pendingCountRef.current === 0) setPending(false);
      };
      void Promise.resolve(result).then(settle, settle);
    }
  };
  const content = <>
    {renderIcon(descriptor.icon)}
    {descriptor.text ? <span>{descriptor.text}</span> : null}
  </>;
  if (href !== undefined) {
    return (
      <a
        className={cx(styles.button, descriptor.className)}
        href={blocked ? undefined : href}
        target={descriptor.target}
        rel={descriptor.target === '_blank' ? 'noopener noreferrer' : undefined}
        role={blocked ? 'link' : undefined}
        aria-label={descriptor.ariaLabel}
        aria-busy={pending || undefined}
        aria-disabled={blocked || undefined}
        title={descriptor.title}
        tabIndex={blocked ? -1 : tabIndex}
        data-disabled={blocked || undefined}
        onMouseDown={(event) => {
          if (descriptor.preventFocusLoss !== false) event.preventDefault();
        }}
        onClick={(event) => {
          if (blocked) { event.preventDefault(); return; }
          press(event);
        }}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type={descriptor.type ?? 'button'}
      className={cx(styles.button, descriptor.className)}
      aria-label={descriptor.ariaLabel}
      aria-busy={pending || undefined}
      title={descriptor.title}
      tabIndex={tabIndex}
      disabled={blocked}
      onPointerDown={interaction?.onPointerDown}
      onPointerUp={interaction?.onPointerUp}
      onPointerCancel={interaction?.onPointerCancel}
      onLostPointerCapture={interaction?.onLostPointerCapture}
      onMouseDown={(event) => {
        if (descriptor.preventFocusLoss !== false) event.preventDefault();
      }}
      onClick={(event) => {
        if (interaction?.consumeClick?.()) return;
        press(event);
      }}
    >
      {content}
    </button>
  );
}
