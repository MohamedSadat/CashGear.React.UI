import { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { CgButton } from '../Button';
import { CgPopup } from '../Popup';
import type { CgPopupActions, CgPopupCloseReason } from '../Popup';
import { useCgId, useControllableState, useStableCallback } from '../../hooks';
import { renderIcon } from '../../internal';
import { cx } from '../../utils';
import type {
  CgMessageBoxActions,
  CgMessageBoxCloseReason,
  CgMessageBoxClosedDetails,
  CgMessageBoxProps,
} from './CgMessageBox.types';
import styles from './CgMessageBox.module.css';

function popupReason(reason: CgPopupCloseReason): CgMessageBoxCloseReason {
  return reason;
}

export function CgMessageBox({
  open,
  defaultOpen = false,
  onOpenChange,
  onClosed,
  message,
  children,
  title = 'Message',
  actionLabel = 'OK',
  actionIntent = 'primary',
  actionAppearance = 'solid',
  icon,
  renderIcon: renderIconContent,
  width = '420px',
  className,
  closeOnEscape = true,
  closeOnOutsideClick = false,
  showCloseButton = true,
  closeButtonAriaLabel,
  initialFocus = 'action',
  actionsRef,
  style,
  'data-testid': testId,
}: CgMessageBoxProps) {
  const [actualOpen, setActualOpen] = useControllableState(open, defaultOpen, 'CgMessageBox open');
  const controlled = open !== undefined;
  const openRef = useRef(actualOpen);
  const popupActionsRef = useRef<CgPopupActions>(null);
  const pendingCloseRef = useRef<CgMessageBoxClosedDetails | undefined>(undefined);
  const previousOpenRef = useRef(false);
  const completedRef = useRef(true);
  const messageId = `${useCgId()}-message`;

  useLayoutEffect(() => {
    openRef.current = actualOpen;
    if (actualOpen && !previousOpenRef.current) { completedRef.current = false; pendingCloseRef.current = undefined; }
    previousOpenRef.current = actualOpen;
  }, [actualOpen]);

  const requestOpen = useStableCallback((): Promise<void> => {
    if (openRef.current) return Promise.resolve();
    if (!controlled) { openRef.current = true; setActualOpen(true); }
    onOpenChange?.(true, { reason: 'programmatic' });
    return Promise.resolve();
  });
  const requestClose = useStableCallback(async (accepted: boolean, reason: CgMessageBoxCloseReason, event?: Event | React.SyntheticEvent) => {
    if (!openRef.current) return;
    pendingCloseRef.current = { accepted, reason, event };
    await popupActionsRef.current?.close();
  });
  useImperativeHandle(actionsRef, (): CgMessageBoxActions => ({
    open: requestOpen,
    close: () => requestClose(false, 'programmatic'),
    accept: () => requestClose(true, 'accept'),
    focus: () => popupActionsRef.current?.focus(),
  }), [requestClose, requestOpen]);

  const content = children ?? message;
  return <CgPopup
    open={actualOpen}
    actionsRef={popupActionsRef}
    role="alertdialog"
    header={title}
    showHeader
    showFooter
    showCloseButton={showCloseButton}
    closeButtonAriaLabel={closeButtonAriaLabel}
    closeOnEscape={closeOnEscape}
    closeOnOutsideClick={closeOnOutsideClick}
    width={width}
    className={cx(styles.popup, className)}
    style={style}
    aria-describedby={messageId}
    contentLoadMode="fromMount"
    data-cg-message-box=""
    data-testid={testId}
    onOpenChange={(nextOpen, details) => {
      if (nextOpen) return;
      const pending = pendingCloseRef.current;
      const close = pending ?? { accepted: false, reason: popupReason(details.reason), event: details.event };
      pendingCloseRef.current = close;
      if (!controlled) { openRef.current = false; setActualOpen(false); }
      onOpenChange?.(false, { reason: close.reason, event: close.event });
      if (controlled) queueMicrotask(() => { if (openRef.current) pendingCloseRef.current = undefined; });
    }}
    onAfterClose={(details) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const close = pendingCloseRef.current ?? { accepted: false, reason: popupReason(details.reason), event: details.event };
      pendingCloseRef.current = undefined;
      onClosed?.(close.accepted, close);
    }}
    body={<div className={styles.content}>{renderIconContent || icon ? <span className={styles.icon} aria-hidden="true">{renderIconContent ? renderIconContent() : icon ? renderIcon(icon) : null}</span> : null}<div id={messageId} className={styles.message}>{content}</div></div>}
    footer={<div className={styles.actions}><CgButton className={styles.actionButton} intent={actionIntent} appearance={actionAppearance} data-cg-autofocus={initialFocus === 'action' ? '' : undefined} onClick={(event) => requestClose(true, 'accept', event)}>{actionLabel}</CgButton></div>}
  />;
}
