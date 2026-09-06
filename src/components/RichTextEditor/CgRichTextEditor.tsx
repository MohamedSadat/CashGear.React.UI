import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useCgId, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgLoadingPanel } from '../LoadingPanel';
import { CgPopup } from '../Popup';
import { CgTabs } from '../Tabs';
import { CgToolbar } from '../Toolbar';
import type { CgToolbarItem } from '../Toolbar';
import styles from './CgRichTextEditor.module.css';
import type {
  RichTextEditorBridge,
  RichTextEditorController,
  RichTextEditorOptions,
  RichTextEditorState,
} from '../../vendor/rich-text-editor/editor.js';
import type {
  CgRichTextEditorActions,
  CgRichTextEditorChangeReason,
  CgRichTextEditorCommand,
  CgRichTextEditorLabels,
  CgRichTextEditorProps,
} from './CgRichTextEditor.types';

const COMMAND_LABELS: Record<CgRichTextEditorCommand, string> = {
  undo: 'Undo', redo: 'Redo', bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strike',
  left: 'Left', center: 'Center', right: 'Right', justify: 'Justify', bulletList: 'Bullets',
  orderedList: 'Numbering', indent: 'Indent', outdent: 'Outdent', clear: 'Clear formatting',
  link: 'Link', unlink: 'Remove link', image: 'Image', table: 'Table', rule: 'Horizontal rule',
  addRowBefore: 'Row above', addRowAfter: 'Row below', deleteRow: 'Delete row',
  addColumnBefore: 'Column before', addColumnAfter: 'Column after', deleteColumn: 'Delete column',
  toggleHeaderRow: 'Header row', mergeCells: 'Merge cells', splitCell: 'Split cell', deleteTable: 'Delete table',
};

const DEFAULT_LABELS: CgRichTextEditorLabels = {
  commandLabels: COMMAND_LABELS,
  homeTab: 'Home', insertTab: 'Insert', tableTab: 'Table', paragraphStyle: 'Paragraph style', normal: 'Normal',
  heading1: 'Heading 1', heading2: 'Heading 2', heading3: 'Heading 3', fontFamily: 'Font family',
  defaultFont: 'Default', fontSize: 'Font size', defaultSize: 'Default', textColor: 'Text color',
  highlightColor: 'Highlight color', formattingToolbar: 'Text formatting', insertToolbar: 'Insert content',
  tableToolbar: 'Table editing', moreCommands: 'More commands', linkDialogTitle: 'Edit link',
  imageDialogTitle: 'Insert image', tableDialogTitle: 'Insert table', url: 'URL', alternativeText: 'Alternative text',
  rows: 'Rows', columns: 'Columns', cancel: 'Cancel', apply: 'Apply',
  invalidTable: 'Choose 1-20 rows and 1-10 columns.',
  invalidLinkUrl: 'Enter an HTTPS or application-relative URL, mailto: or tel: link.',
  invalidImageUrl: 'Enter an HTTPS or application-relative URL.', loading: 'Loading editor',
  loadError: 'The rich text editor could not be loaded. Reload the page to try again.',
  documentStatistics: 'Document statistics', words: (count) => `${count} words`,
  characters: (count) => `${count} characters`, disabledStatus: 'Disabled', readOnlyStatus: 'Read only',
  documentStatus: 'HTML document',
};

const EMPTY_STATE: RichTextEditorState = {
  enabled: {}, active: {}, inTable: false, words: 0, characters: 0,
  fontFamily: '', fontSize: '', color: '#0f172a', highlight: '#fef08a', heading: '0',
};

const normalize = (value: string | null | undefined) => value ?? '';
const bindMode = (mode: CgRichTextEditorProps['commitMode']): RichTextEditorOptions['bindValueMode'] => (
  mode === 'input' ? 'OnInput' : mode === 'blur' ? 'OnLostFocus' : 'OnDelayedInput'
);

export const CgRichTextEditor = forwardRef<HTMLDivElement, CgRichTextEditorProps>(function CgRichTextEditor({
  value,
  defaultValue,
  onValueChange,
  commitMode = 'debounced',
  inputDelay = 500,
  readOnly = false,
  disabled = false,
  placeholder = '',
  height = '360px',
  showRibbon = true,
  showStatusBar = true,
  direction = 'auto',
  inputId,
  ariaLabel = 'Rich text editor',
  ariaLabelledBy,
  ariaDescribedBy,
  name,
  form,
  required = false,
  onInvalid,
  labels,
  actionsRef,
  onError,
  className,
  style,
  ...nativeProps
}, forwardedRef) {
  if (!Number.isInteger(inputDelay) || inputDelay < 0) throw new RangeError('CgRichTextEditor inputDelay must be a nonnegative integer.');
  if (typeof height === 'string' && (!height.trim() || /[;{}]/u.test(height))) throw new Error('CgRichTextEditor height must be one CSS length.');

  const text = useMemo(() => ({
    ...DEFAULT_LABELS,
    ...labels,
    commandLabels: { ...COMMAND_LABELS, ...labels?.commandLabels },
  }), [labels]);
  const generatedInputId = useCgId(inputId);
  const initialValue = useRef(normalize(value === undefined ? defaultValue : value));
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue.current);
  const effectiveValue = value === undefined ? uncontrolledValue : normalize(value);
  const [formValue, setFormValue] = useState(initialValue.current);
  const [state, setState] = useState<RichTextEditorState>(EMPTY_STATE);
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [invalid, setInvalid] = useState(false);
  const [dialog, setDialog] = useState<'link' | 'image' | 'table'>('link');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<RichTextEditorController | null>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const generation = useRef(0);
  const observedValue = useRef(initialValue.current);
  const lastEmitted = useRef<string | null>(null);
  const lastSequence = useRef(0);
  const flushRequested = useRef(false);
  const callbacks = useRef({ onValueChange, onError });
  callbacks.current = { onValueChange, onError };
  const loadErrorText = useRef(text.loadError);
  loadErrorText.current = text.loadError;
  const optionsRef = useRef<RichTextEditorOptions>({
    html: initialValue.current, generation: 0, disabled, readOnly, placeholder, inputId: generatedInputId,
    ariaLabel, ariaLabelledBy: ariaLabelledBy ?? '', ariaDescribedBy: ariaDescribedBy ?? '', ariaInvalid: false,
    direction: resolvedDirection, bindValueMode: bindMode(commitMode), inputDelay,
  });

  const reportError = useStableCallback((phase: 'initialization' | 'commit' | 'command', error: unknown) => {
    callbacks.current.onError?.(Object.freeze({ phase, error }));
  });
  const syncFormValue = useStableCallback(() => {
    const next = controllerRef.current?.getHtml();
    if (next !== undefined) {
      setFormValue(next);
      if (next) setInvalid(false);
    }
  });
  const receiveHtml = useStableCallback(async (html: string, nextGeneration: number, sequence: number) => {
    if (disabled || readOnly || nextGeneration !== generation.current || sequence <= lastSequence.current) return;
    lastSequence.current = sequence;
    setFormValue(html);
    if (html) setInvalid(false);
    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    if (value === undefined) setUncontrolledValue(html);
    const reason: CgRichTextEditorChangeReason = flushRequested.current
      ? 'flush'
      : commitMode === 'input' ? 'input' : commitMode === 'blur' ? 'blur' : 'debounce';
    flushRequested.current = false;
    try {
      await callbacks.current.onValueChange?.(html, Object.freeze({ reason }));
    } catch (error) {
      reportError('commit', error);
    }
  });
  const receiveState = useStableCallback((next: RichTextEditorState) => setState(next));

  useEffect(() => {
    if (effectiveValue !== observedValue.current) {
      observedValue.current = effectiveValue;
      if (effectiveValue !== lastEmitted.current) {
        generation.current += 1;
        lastSequence.current = 0;
        lastEmitted.current = null;
      }
      setFormValue(effectiveValue);
    }
    const options: RichTextEditorOptions = {
      html: effectiveValue, generation: generation.current, disabled, readOnly, placeholder, inputId: generatedInputId,
      ariaLabel, ariaLabelledBy: ariaLabelledBy ?? '', ariaDescribedBy: ariaDescribedBy ?? '', ariaInvalid: invalid,
      direction: resolvedDirection, bindValueMode: bindMode(commitMode), inputDelay,
    };
    optionsRef.current = options;
    const controller = controllerRef.current;
    controller?.setOptions(options);
    if (controller) setFormValue(controller.getHtml());
    if (disabled || readOnly) setDialogOpen(false);
  }, [ariaDescribedBy, ariaLabel, ariaLabelledBy, commitMode, disabled, effectiveValue, generatedInputId, inputDelay, invalid, placeholder, readOnly, resolvedDirection]);

  useEffect(() => {
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) return;
    let disposed = false;
    let controller: RichTextEditorController | null = null;
    const bridge: RichTextEditorBridge = {
      invokeMethodAsync(method: 'ReceiveHtmlAsync' | 'ReceiveState', ...args: [string, number, number] | [RichTextEditorState]) {
        return method === 'ReceiveHtmlAsync'
          ? receiveHtml(args[0] as string, args[1] as number, args[2] as number)
          : Promise.resolve(receiveState(args[0] as RichTextEditorState));
      },
    };
    void import('../../vendor/rich-text-editor/editor.js').then(({ create }) => {
      if (disposed || !host.isConnected) return;
      controller = create(host, root, bridge, optionsRef.current);
      if (disposed) { controller.dispose(); return; }
      controllerRef.current = controller;
      setFormValue(controller.getHtml());
      setInitialized(true);
    }).catch((error: unknown) => {
      if (disposed) return;
      setLoadError(loadErrorText.current);
      reportError('initialization', error);
    });
    return () => {
      disposed = true;
      controller?.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [receiveHtml, receiveState, reportError]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handleError = (event: Event) => reportError('commit', (event as CustomEvent<unknown>).detail);
    root.addEventListener('cg-editor-error', handleError);
    return () => root.removeEventListener('cg-editor-error', handleError);
  }, [reportError]);

  const resetFromForm = useStableCallback(() => {
    const next = normalize(value === undefined ? defaultValue : value);
    generation.current += 1;
    lastSequence.current = 0;
    lastEmitted.current = null;
    observedValue.current = next;
    setFormValue(next);
    if (value === undefined) {
      setUncontrolledValue(next);
      Promise.resolve(callbacks.current.onValueChange?.(next, Object.freeze({ reason: 'reset' as const })))
        .catch((error: unknown) => reportError('commit', error));
    }
    const options = { ...optionsRef.current, html: next, generation: generation.current };
    optionsRef.current = options;
    const controller = controllerRef.current;
    controller?.setOptions(options);
    if (controller) setFormValue(controller.getHtml());
  });
  useFormReset(proxyRef, resetFromForm);

  const runCommand = useStableCallback((command: string, commandValue?: unknown) => {
    if (!controllerRef.current || disabled || readOnly) return false;
    try {
      const result = controllerRef.current.command(command, commandValue);
      syncFormValue();
      return result;
    } catch (error) {
      reportError('command', error);
      return false;
    }
  });
  const openDialog = useStableCallback((kind: 'link' | 'image' | 'table') => {
    if (!controllerRef.current || disabled || readOnly) return;
    setDialog(kind);
    setDialogError('');
    setAlt('');
    setUrl(kind === 'link' ? controllerRef.current.getLink() : '');
    setDialogOpen(true);
  });
  const applyDialog = useStableCallback(() => {
    const controller = controllerRef.current;
    if (!controller || disabled || readOnly) return;
    if (dialog === 'table') {
      if (!Number.isInteger(rows) || rows < 1 || rows > 20 || !Number.isInteger(columns) || columns < 1 || columns > 10) {
        setDialogError(text.invalidTable);
        return;
      }
      runCommand('table', { rows, columns });
    } else {
      const trimmed = url.trim();
      if (!controller.validateUrl(trimmed, dialog === 'image')) {
        setDialogError(dialog === 'image' ? text.invalidImageUrl : text.invalidLinkUrl);
        return;
      }
      runCommand(dialog, { url: trimmed, alt });
    }
    setDialogOpen(false);
  });

  useImperativeHandle(actionsRef, (): CgRichTextEditorActions => ({
    focus: () => controllerRef.current?.focus(),
    getHtml: () => controllerRef.current?.getHtml() ?? formValue,
    async flush() {
      const controller = controllerRef.current;
      if (!controller) return;
      flushRequested.current = true;
      await controller.flush();
      flushRequested.current = false;
      syncFormValue();
    },
  }), [formValue, syncFormValue]);

  const canEdit = initialized && !disabled && !readOnly;
  const enabled = (command: CgRichTextEditorCommand) => canEdit && state.enabled[command] === true;
  const toolbarItems = (commands: ReadonlyArray<CgRichTextEditorCommand>): ReadonlyArray<CgToolbarItem> => commands.map((command, index) => ({
    name: command,
    text: text.commandLabels[command],
    disabled: !enabled(command),
    beginGroup: ['bold', 'left', 'bulletList', 'clear', 'image', 'addColumnBefore', 'toggleHeaderRow', 'deleteTable'].includes(command) || index === 0,
    ...(state.active[command] !== undefined ? { checked: state.active[command] } : {}),
    onClick: () => { void runCommand(command); },
  }));
  const formatItems = toolbarItems(['undo', 'redo', 'bold', 'italic', 'underline', 'strike', 'left', 'center', 'right', 'justify', 'bulletList', 'orderedList', 'indent', 'outdent', 'clear']);
  const insertItems: ReadonlyArray<CgToolbarItem> = [
    { name: 'link', text: text.commandLabels.link, disabled: !canEdit, onClick: () => openDialog('link') },
    { name: 'unlink', text: text.commandLabels.unlink, disabled: !enabled('unlink'), onClick: () => { void runCommand('unlink'); } },
    { name: 'image', text: text.commandLabels.image, beginGroup: true, disabled: !canEdit, onClick: () => openDialog('image') },
    { name: 'table', text: text.commandLabels.table, disabled: !canEdit, onClick: () => openDialog('table') },
    { name: 'rule', text: text.commandLabels.rule, disabled: !enabled('rule'), onClick: () => { void runCommand('rule'); } },
  ];
  const tableItems = toolbarItems(['addRowBefore', 'addRowAfter', 'deleteRow', 'addColumnBefore', 'addColumnAfter', 'deleteColumn', 'toggleHeaderRow', 'mergeCells', 'splitCell', 'deleteTable']);
  const settings = <>
    <div className={styles.settings}>
      <label>{text.paragraphStyle}<select aria-label={text.paragraphStyle} value={state.heading} disabled={!canEdit} onChange={(event) => void runCommand('heading', event.target.value)}>
        <option value="0">{text.normal}</option><option value="1">{text.heading1}</option><option value="2">{text.heading2}</option><option value="3">{text.heading3}</option>
      </select></label>
      <label>{text.fontFamily}<select aria-label={text.fontFamily} value={state.fontFamily} disabled={!canEdit} onChange={(event) => void runCommand('fontFamily', event.target.value)}>
        <option value="">{text.defaultFont}</option><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option><option>Tahoma</option>
      </select></label>
      <label>{text.fontSize}<select aria-label={text.fontSize} value={state.fontSize} disabled={!canEdit} onChange={(event) => void runCommand('fontSize', event.target.value)}>
        <option value="">{text.defaultSize}</option>{[10, 12, 14, 16, 18, 24, 32, 48].map((size) => <option key={size} value={`${size}px`}>{size}</option>)}
      </select></label>
      <label>{text.textColor}<input type="color" aria-label={text.textColor} value={state.color} disabled={!canEdit} onChange={(event) => void runCommand('color', event.target.value)} /></label>
      <label>{text.highlightColor}<input type="color" aria-label={text.highlightColor} value={state.highlight} disabled={!canEdit} onChange={(event) => void runCommand('highlight', event.target.value)} /></label>
    </div>
    <CgToolbar items={formatItems} ariaLabel={text.formattingToolbar} autoCollapseText={false} overflowButtonLabel={text.moreCommands} />
  </>;
  const tabs = [
    { key: 'home', text: text.homeTab, content: settings },
    { key: 'insert', text: text.insertTab, content: <CgToolbar items={insertItems} ariaLabel={text.insertToolbar} autoCollapseText={false} overflowButtonLabel={text.moreCommands} /> },
    { key: 'table', text: text.tableTab, visible: state.inTable, content: <CgToolbar items={tableItems} ariaLabel={text.tableToolbar} autoCollapseText={false} overflowButtonLabel={text.moreCommands} /> },
  ];
  const dialogTitle = dialog === 'image' ? text.imageDialogTitle : dialog === 'table' ? text.tableDialogTitle : text.linkDialogTitle;
  const handleInvalid = (event: FormEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setInvalid(true);
    controllerRef.current?.focus();
    onInvalid?.(event);
  };

  return <div
    {...nativeProps}
    ref={mergedRef}
    className={cx(styles.root, className)}
    style={style}
    dir={resolvedDirection}
    aria-busy={!initialized && !loadError || undefined}
    data-cg-rich-text=""
    data-disabled={disabled || undefined}
    data-invalid={invalid || undefined}
    onInputCapture={syncFormValue}
  >
    {showRibbon ? <div className={styles.ribbon}><CgTabs tabs={tabs} contentMode="all" ariaLabel={ariaLabel} /></div> : null}
    {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}
    <div ref={hostRef} className={styles.surface} style={{ height }} data-disabled={disabled || undefined} />
    {!initialized && !loadError ? <CgLoadingPanel visible mode="inline" blocking={false} text={text.loading} /> : null}
    {showStatusBar ? <div className={styles.status} aria-label={text.documentStatistics}>
      <span dir="ltr">{text.words(state.words)} · {text.characters(state.characters)}</span>
      <span>{disabled ? text.disabledStatus : readOnly ? text.readOnlyStatus : text.documentStatus}</span>
    </div> : null}
    <textarea
      ref={proxyRef}
      className={styles.formProxy}
      value={formValue}
      onChange={() => undefined}
      name={name}
      form={form}
      required={required}
      disabled={disabled || !initialized}
      tabIndex={-1}
      aria-hidden="true"
      onInvalid={handleInvalid}
    />
    <CgPopup open={dialogOpen} onOpenChange={setDialogOpen} headerText={dialogTitle} width="420px">
      <div className={styles.dialog}>
        {dialog === 'table' ? <>
          <label>{text.rows}<input type="number" min={1} max={20} value={rows} onChange={(event) => setRows(event.target.valueAsNumber)} /></label>
          <label>{text.columns}<input type="number" min={1} max={10} value={columns} onChange={(event) => setColumns(event.target.valueAsNumber)} /></label>
        </> : <>
          <label>{text.url}<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" /></label>
          {dialog === 'image' ? <label>{text.alternativeText}<input value={alt} onChange={(event) => setAlt(event.target.value)} /></label> : null}
        </>}
        {dialogError ? <p className={styles.dialogError} role="alert">{dialogError}</p> : null}
        <div className={styles.dialogActions}>
          <CgButton appearance="outline" onClick={() => setDialogOpen(false)}>{text.cancel}</CgButton>
          <CgButton intent="primary" onClick={applyDialog}>{text.apply}</CgButton>
        </div>
      </div>
    </CgPopup>
  </div>;
});
