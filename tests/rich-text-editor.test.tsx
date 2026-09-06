import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CgRichTextEditor } from '../src';
import type { CgRichTextEditorActions } from '../src';
import type { RichTextEditorBridge, RichTextEditorOptions, RichTextEditorState } from '../src/vendor/rich-text-editor/editor.js';

const mock = vi.hoisted(() => ({
  html: '',
  sequence: 0,
  bridge: undefined as RichTextEditorBridge | undefined,
  options: undefined as RichTextEditorOptions | undefined,
  editor: undefined as HTMLDivElement | undefined,
  command: vi.fn((_name: string, _value?: unknown) => true),
  setOptions: vi.fn((options: RichTextEditorOptions) => { mock.options = options; }),
  focus: vi.fn(),
  dispose: vi.fn(),
  create: vi.fn((host: HTMLElement, _root: HTMLElement, bridge: RichTextEditorBridge, options: RichTextEditorOptions) => {
    mock.bridge = bridge;
    mock.options = options;
    mock.html = options.html;
    const editor = document.createElement('div');
    editor.id = options.inputId;
    editor.contentEditable = options.disabled || options.readOnly ? 'false' : 'true';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-label', options.ariaLabel);
    editor.innerHTML = options.html;
    host.append(editor);
    mock.editor = editor;
    const commands = ['undo', 'redo', 'bold', 'italic', 'underline', 'strike', 'left', 'center', 'right', 'justify', 'bulletList', 'orderedList', 'indent', 'outdent', 'clear', 'unlink', 'rule', 'addRowBefore', 'addRowAfter', 'deleteRow', 'addColumnBefore', 'addColumnAfter', 'deleteColumn', 'toggleHeaderRow', 'mergeCells', 'splitCell', 'deleteTable'];
    const enabled = Object.fromEntries(commands.map((name) => [name, true]));
    const active = Object.fromEntries(commands.map((name) => [name, name === 'bold']));
    const state: RichTextEditorState = { enabled, active, inTable: true, words: 2, characters: 11, fontFamily: '', fontSize: '', color: '#0f172a', highlight: '#fef08a', heading: '0' };
    void bridge.invokeMethodAsync('ReceiveState', state);
    return {
      setOptions: mock.setOptions,
      command: mock.command,
      getLink: () => 'https://cashgear.test',
      validateUrl: (url: string, image = false) => url.startsWith('/') || url.startsWith('https://') || (!image && /^(mailto:|tel:)/u.test(url)),
      getHtml: () => mock.html,
      flush: async () => {
        mock.sequence += 1;
        await bridge.invokeMethodAsync('ReceiveHtmlAsync', mock.html, mock.options?.generation ?? 0, mock.sequence);
      },
      focus: mock.focus,
      dispose: mock.dispose,
    };
  }),
}));

vi.mock('../src/vendor/rich-text-editor/editor.js', () => ({ create: mock.create }));

describe('CgRichTextEditor', () => {
  beforeEach(() => {
    mock.html = '';
    mock.sequence = 0;
    mock.bridge = undefined;
    mock.options = undefined;
    mock.editor = undefined;
    mock.command.mockClear();
    mock.setOptions.mockClear();
    mock.focus.mockClear();
    mock.dispose.mockClear();
    mock.create.mockClear();
  });

  it('lazily initializes, maps commit modes, updates options, and disposes', async () => {
    const view = render(<CgRichTextEditor value={null} commitMode="blur" inputDelay={25} ariaLabel="Notes" readOnly />);
    expect(mock.create).not.toHaveBeenCalled();
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    expect(mock.options).toMatchObject({ html: '', bindValueMode: 'OnLostFocus', inputDelay: 25, readOnly: true, ariaLabel: 'Notes' });
    view.rerender(<CgRichTextEditor value="<p>External</p>" commitMode="input" ariaLabel="Notes" />);
    expect(mock.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>External</p>', bindValueMode: 'OnInput', generation: 1 }));
    view.unmount();
    expect(mock.dispose).toHaveBeenCalledTimes(1);
    expect(() => render(<CgRichTextEditor inputDelay={-1} />)).toThrow(/inputDelay/);
  });

  it('exposes every command family and preserves selection through dialogs', async () => {
    render(<CgRichTextEditor defaultValue="<p>Hello world</p>" />);
    await screen.findByRole('textbox', { name: 'Rich text editor' });
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(mock.command).toHaveBeenCalledWith('bold', undefined);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Paragraph style' }), '2');
    expect(mock.command).toHaveBeenCalledWith('heading', '2');
    await userEvent.click(screen.getByRole('tab', { name: 'Insert' }));
    await userEvent.click(screen.getByRole('button', { name: 'Horizontal rule' }));
    expect(mock.command).toHaveBeenCalledWith('rule', undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByRole('dialog', { name: 'Edit link' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(mock.command).toHaveBeenCalledWith('link', { url: 'https://cashgear.test', alt: '' });
    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
    await userEvent.click(screen.getByRole('button', { name: 'Row above' }));
    expect(mock.command).toHaveBeenCalledWith('addRowBefore', undefined);
  });

  it('updates the native form value immediately and transfers invalid focus', async () => {
    const submitted = vi.fn();
    const { container } = render(<form onSubmit={(event) => { event.preventDefault(); submitted(Object.fromEntries(new FormData(event.currentTarget))); }}>
      <CgRichTextEditor name="notes" required defaultValue="" />
      <button type="submit">Save</button>
    </form>);
    const editor = await screen.findByRole('textbox', { name: 'Rich text editor' });
    const proxy = container.querySelector('textarea[name="notes"]')!;
    fireEvent.invalid(proxy);
    expect(mock.focus).toHaveBeenCalled();
    mock.html = '<p>Typed</p>';
    fireEvent.input(editor);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted).toHaveBeenCalledWith({ notes: '<p>Typed</p>' });
  });

  it('serializes callback completion through flush and keeps controlled echoes in one generation', async () => {
    const actions = createRef<CgRichTextEditorActions>();
    let release: (() => void) | undefined;
    const changed = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const view = render(<CgRichTextEditor actionsRef={actions} value="<p>Old</p>" onValueChange={changed} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalled());
    mock.html = '<p>New</p>';
    let flushed = false;
    const flushing = actions.current!.flush().then(() => { flushed = true; });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('<p>New</p>', { reason: 'flush' }));
    expect(flushed).toBe(false);
    await act(async () => { release?.(); await flushing; });
    expect(flushed).toBe(true);
    view.rerender(<CgRichTextEditor actionsRef={actions} value="<p>New</p>" onValueChange={changed} />);
    expect(mock.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>New</p>', generation: 0 }));
    expect(actions.current?.getHtml()).toBe('<p>New</p>');
    act(() => actions.current?.focus());
    expect(mock.focus).toHaveBeenCalled();
  });

  it('resets uncontrolled form state and reports asynchronous callback failures', async () => {
    const error = vi.fn();
    const changed = vi.fn(async () => { throw new Error('save failed'); });
    const { container } = render(<form><CgRichTextEditor name="notes" defaultValue="<p>Initial</p>" onValueChange={changed} onError={error} /></form>);
    const editor = await screen.findByRole('textbox', { name: 'Rich text editor' });
    mock.html = '<p>Draft</p>';
    fireEvent.input(editor);
    fireEvent.reset(container.querySelector('form')!);
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.objectContaining({ phase: 'commit', error: expect.any(Error) })));
    expect(mock.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ html: '<p>Initial</p>' }));
  });

  it('renders an accessible initialization error', async () => {
    mock.create.mockImplementationOnce(() => { throw new Error('load failed'); });
    const error = vi.fn();
    render(<CgRichTextEditor onError={error} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ phase: 'initialization' }));
  });
});
