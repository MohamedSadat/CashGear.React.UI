import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { ClipboardEvent, ForwardedRef, KeyboardEvent, ReactElement, RefAttributes } from 'react';
import { useCgId } from '../../hooks';
import { cx } from '../../utils';
import { CgCommandMenu } from '../CommandMenu';
import type { CgCommandMenuHandle } from '../CommandMenu';
import styles from './CgMentionArea.module.css';
import type { CgMentionAreaHandle, CgMentionAreaProps, CgMentionAreaSuggestion } from './CgMentionArea.types';
import { isEmpty, mentionAtom, queryAt, readValue, writeValue } from './mentionDom';

interface Open<TData> {
  node: Text;
  start: number;
  trigger: string;
  suggestions: ReadonlyArray<CgMentionAreaSuggestion<TData>>;
}

/** Plain text at the caret, keeping the browser's undo history where it can. */
function insertPlainText(doc: Document, text: string) {
  if (doc.execCommand?.('insertText', false, text)) return;
  const selection = doc.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = doc.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * An editable area that writes text, line breaks and mentions: a trigger ("@") typed at a word
 * start offers suggestions, chosen with the arrows and Enter or Tab, or the pointer, while the
 * area keeps focus. Pasted content goes in as plain text. Nothing renders per keystroke.
 */
function CgMentionAreaInner<TData>(
  {
    label,
    placeholder,
    defaultValue,
    triggers = ['@'],
    suggest,
    listLabel,
    onValueChange,
    onSubmit,
    onCancel,
    disabled = false,
    autoFocus = false,
    renderSuggestion,
    id,
    className,
    onKeyDown: onKeyDownProp,
    onBlur: onBlurProp,
    ...nativeProps
  }: CgMentionAreaProps<TData>,
  forwardedRef: ForwardedRef<CgMentionAreaHandle>,
) {
  if (!label.trim() || !listLabel.trim()) throw new Error('CgMentionArea label and listLabel cannot be empty.');
  const baseId = useCgId(id);
  const areaRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<CgCommandMenuHandle>(null);
  const [open, setOpen] = useState<Open<TData> | null>(null);
  const [activeId, setActiveId] = useState<string>();
  const atomClass = styles.mention!;

  const markEmpty = () => {
    const area = areaRef.current;
    if (area) area.toggleAttribute('data-empty', isEmpty(area));
  };

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (area && defaultValue) writeValue(area, defaultValue, atomClass);
    markEmpty();
    // Only the content it opens with: later changes are the person's own.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (autoFocus) areaRef.current?.focus(); }, [autoFocus]);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => areaRef.current?.focus(),
    clear: () => { areaRef.current?.replaceChildren(); setOpen(null); markEmpty(); },
    getValue: () => (areaRef.current ? readValue(areaRef.current) : []),
    setValue: (value) => { if (areaRef.current) { writeValue(areaRef.current, value, atomClass); setOpen(null); markEmpty(); } },
  }));

  const findQuery = () => {
    const area = areaRef.current;
    const selection = area?.ownerDocument.getSelection();
    const node = selection?.focusNode;
    if (!area || !selection?.isCollapsed || !node || node.nodeType !== 3 || !area.contains(node)) { setOpen(null); return; }
    const found = queryAt((node as Text).data, selection.focusOffset, triggers);
    if (!found) { setOpen(null); return; }
    const suggestions = suggest(found.query, found.trigger);
    setOpen((was) => {
      const same = was && was.node === node && was.start === found.start && was.suggestions.length === suggestions.length && was.suggestions.every((item, index) => item.key === suggestions[index]!.key);
      if (same) return was;
      return suggestions.length ? { node: node as Text, start: found.start, trigger: found.trigger, suggestions } : null;
    });
  };

  const pick = (suggestion: CgMentionAreaSuggestion<TData>) => {
    const area = areaRef.current;
    if (!area || !open) return;
    const doc = area.ownerDocument;
    const selection = doc.getSelection();
    const end = selection?.focusNode === open.node ? Math.max(open.start, selection.focusOffset) : open.node.length;
    const range = doc.createRange();
    range.setStart(open.node, Math.min(open.start, open.node.length));
    range.setEnd(open.node, Math.min(end, open.node.length));
    range.deleteContents();
    const atom = mentionAtom(doc, { ...suggestion.mention, text: suggestion.text ?? `${open.trigger}${suggestion.label}` }, atomClass);
    range.insertNode(atom);
    const space = doc.createTextNode(' ');
    atom.after(space);
    const caret = doc.createRange();
    caret.setStart(space, 1);
    caret.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(caret);
    setOpen(null);
    markEmpty();
    onValueChange?.(readValue(area));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDownProp?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (open && menuRef.current?.handleKeyDown(event)) {
      if (event.key === 'Escape') event.stopPropagation();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onSubmit && areaRef.current) {
      event.preventDefault();
      onSubmit(readValue(areaRef.current));
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  const listId = `${baseId}-suggestions`;
  return <div className={cx(styles.root, className)} data-cg-mention-area="">
    <div
      {...nativeProps}
      ref={areaRef}
      id={baseId}
      className={styles.area}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      aria-placeholder={placeholder}
      aria-autocomplete="list"
      aria-controls={open ? `${listId}-list` : undefined}
      aria-activedescendant={open ? activeId : undefined}
      aria-disabled={disabled || undefined}
      data-placeholder={placeholder}
      contentEditable={!disabled}
      suppressContentEditableWarning
      dir="auto"
      tabIndex={disabled ? -1 : 0}
      onInput={() => { markEmpty(); findQuery(); if (onValueChange && areaRef.current) onValueChange(readValue(areaRef.current)); }}
      onKeyUp={(event) => {
        // The caret moved without typing: the list follows it, except while it is walked.
        if ((event.key.startsWith('Arrow') && !(open && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) || event.key === 'Home' || event.key === 'End') findQuery();
      }}
      onKeyDown={onKeyDown}
      onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        insertPlainText(event.currentTarget.ownerDocument, event.clipboardData.getData('text/plain'));
        markEmpty();
        if (onValueChange && areaRef.current) onValueChange(readValue(areaRef.current));
      }}
      onBlur={(event) => { setOpen(null); onBlurProp?.(event); }}
    />
    {open ? <div className={styles.suggestions}>
      <CgCommandMenu
        ref={menuRef}
        id={listId}
        items={open.suggestions}
        filter={false}
        label={listLabel}
        emptyText=""
        selectOnTab
        onActiveDescendantChange={setActiveId}
        onSelect={(item) => pick(item as CgMentionAreaSuggestion<TData>)}
        onDismiss={() => setOpen(null)}
        renderItem={renderSuggestion ? ({ item, active }) => renderSuggestion(item as CgMentionAreaSuggestion<TData>, active) : undefined}
        maxHeight="16rem"
      />
    </div> : null}
  </div>;
}

export const CgMentionArea = forwardRef(CgMentionAreaInner) as <TData = unknown>(
  props: CgMentionAreaProps<TData> & RefAttributes<CgMentionAreaHandle>,
) => ReactElement | null;
