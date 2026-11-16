import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgInlineNumberEditor } from './CgInlineNumberEditor';
import { CgInlineTextEditor } from './CgInlineTextEditor';
import type { CgInlineEditorHandle } from './CgInlineEditor.types';

describe('CgInlineTextEditor', () => {
  it('focuses and selects its text, commits on Enter, and reports the end once', async () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(<CgInlineTextEditor label="الاسم" defaultValue="ليلى" onCommit={onCommit} onDone={onDone} />);
    const input = screen.getByRole('textbox', { name: 'الاسم' });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('dir', 'auto');
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe(4);
    await userEvent.keyboard('سامي{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('سامي', { end: 'enter', text: 'سامي', changed: true });
    act(() => input.blur());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ end: 'enter', committed: true });
  });

  it('never re-renders its owner while typing', async () => {
    const renders = vi.fn();
    function Owner() { renders(); const [value] = useState('x'); return <CgInlineTextEditor label="ملاحظة" defaultValue={value} onCommit={() => undefined} />; }
    render(<Owner />);
    const before = renders.mock.calls.length;
    await userEvent.keyboard('نص طويل يُكتب حرفاً حرفاً');
    expect(renders.mock.calls.length).toBe(before);
  });

  it('puts the starting text back on Escape and commits nothing', async () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(<CgInlineTextEditor label="العنوان" defaultValue="مسودة" onCommit={onCommit} onDone={onDone} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await userEvent.keyboard('جديد{Escape}');
    expect(input.value).toBe('مسودة');
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ end: 'escape', committed: false });
  });

  it('commits on Tab and Shift+Tab without moving focus, and on blur', async () => {
    const onCommit = vi.fn();
    const { rerender } = render(<><CgInlineTextEditor key="a" label="أ" defaultValue="1" onCommit={onCommit} /><button type="button">بعده</button></>);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(onCommit).toHaveBeenLastCalledWith('1', { end: 'shiftTab', text: '1', changed: false });
    expect(screen.getByRole('textbox')).toHaveFocus();
    rerender(<><CgInlineTextEditor key="b" label="ب" defaultValue="2" onCommit={onCommit} /><button type="button">بعده</button></>);
    await userEvent.keyboard('3');
    await userEvent.click(screen.getByRole('button'));
    expect(onCommit).toHaveBeenLastCalledWith('3', { end: 'blur', text: '3', changed: true });
  });

  it('lets Tab move focus when not captured, and ends without committing on blur when asked', async () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(<><CgInlineTextEditor label="أ" defaultValue="1" captureTab={false} commitOnBlur={false} onCommit={onCommit} onDone={onDone} /><button type="button">بعده</button></>);
    await userEvent.keyboard('9{Tab}');
    expect(screen.getByRole('button')).toHaveFocus();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ end: 'blur', committed: false });
  });

  it('starts with the caret at the end when asked, and keeps keys and presses from its container', async () => {
    const outer = vi.fn();
    render(<div onKeyDown={outer} onMouseDown={outer}><CgInlineTextEditor label="أ" defaultValue="ب" initialSelection="end" onCommit={() => undefined} /></div>);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.selectionStart).toBe(1);
    await userEvent.keyboard('x');
    fireEvent.mouseDown(input);
    expect(outer).not.toHaveBeenCalled();
  });

  it('as a text area, keeps Shift+Enter as a new line and commits on Enter', async () => {
    const onCommit = vi.fn();
    render(<CgInlineTextEditor multiline label="الوصف" defaultValue="" onCommit={onCommit} />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    await userEvent.keyboard('سطر{Shift>}{Enter}{/Shift}سطر آخر{Enter}');
    expect(onCommit).toHaveBeenCalledWith('سطر\nسطر آخر', expect.objectContaining({ end: 'enter' }));
  });

  it('ignores Enter while composing', () => {
    const onCommit = vi.fn();
    render(<CgInlineTextEditor label="أ" defaultValue="" onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('stays mounted for the next edit: the next key starts it, focus starts it again', async () => {
    const onCommit = vi.fn();
    const ref = createRef<CgInlineEditorHandle>();
    render(<><CgInlineTextEditor ref={ref} label="العنوان" defaultValue="أ" autoFocus={false} onCommit={onCommit} /><button type="button">x</button></>);
    ref.current!.focus();
    await userEvent.keyboard('{End}ب{Enter}ج{Enter}');
    expect(onCommit.mock.calls.map((call) => call[0] as string)).toEqual(['أب', 'أبج']);
    expect(ref.current!.text).toBe('أبج');
    await userEvent.click(screen.getByRole('button'));
    ref.current!.focus();
    await userEvent.keyboard('{End}د{Escape}');
    expect(ref.current!.text).toBe('أبج');
  });

  it('shows a new starting text only while not focused', () => {
    const { rerender } = render(<CgInlineTextEditor label="أ" defaultValue="1" autoFocus={false} onCommit={() => undefined} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    rerender(<CgInlineTextEditor label="أ" defaultValue="2" autoFocus={false} onCommit={() => undefined} />);
    expect(input.value).toBe('2');
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'typed' } });
    rerender(<CgInlineTextEditor label="أ" defaultValue="3" autoFocus={false} onCommit={() => undefined} />);
    expect(input.value).toBe('typed');
  });
});

describe('CgInlineNumberEditor', () => {
  it('reads Arabic-Indic digits and separators, and commits null for empty text', async () => {
    const onCommit = vi.fn();
    const { unmount } = render(<CgInlineNumberEditor label="الكمية" defaultValue={12.5} invalidMessage="ليس رقماً" locale="ar-EG" onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'الكمية' });
    expect(input).toHaveValue('12.5');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    await userEvent.keyboard('١٬٢٣٤٫٥{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith(1234.5, expect.objectContaining({ end: 'enter', changed: true }));
    unmount();
    render(<CgInlineNumberEditor label="الكمية" defaultValue={3} invalidMessage="ليس رقماً" onCommit={onCommit} />);
    await userEvent.keyboard('{Backspace}{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith(null, expect.objectContaining({ end: 'enter' }));
  });

  it('marks text that is not a number invalid on Enter and stays; typing clears the mark', async () => {
    const onCommit = vi.fn();
    const onInvalid = vi.fn();
    const onDone = vi.fn();
    render(<CgInlineNumberEditor label="السعر" defaultValue={null} invalidMessage="أدخل رقماً" onCommit={onCommit} onInvalidText={onInvalid} onDone={onDone} />);
    const input = screen.getByRole('textbox');
    await userEvent.keyboard('abc{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('title', 'أدخل رقماً');
    expect(onInvalid).toHaveBeenCalledWith('abc');
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    await userEvent.keyboard('{Backspace}');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('title');
  });

  it('puts the starting number back when left with text that is not a number', async () => {
    const onCommit = vi.fn();
    const onDone = vi.fn();
    render(<><CgInlineNumberEditor label="السعر" defaultValue={7} invalidMessage="أدخل رقماً" onCommit={onCommit} onDone={onDone} /><button type="button">x</button></>);
    await userEvent.keyboard('x');
    await userEvent.click(screen.getByRole('button'));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ end: 'blur', committed: false });
    expect(screen.getByRole('textbox')).toHaveValue('7');
  });

  it('takes a reading and a format of the caller', async () => {
    const onCommit = vi.fn();
    render(<CgInlineNumberEditor label="النسبة" defaultValue={0.25} format={(value) => `${value * 100}%`} parse={(text) => (text.trim() ? Number(text.replace('%', '')) / 100 : null)} invalidMessage="x" onCommit={onCommit} />);
    expect(screen.getByRole('textbox')).toHaveValue('25%');
    await userEvent.keyboard('40%{Tab}');
    expect(onCommit).toHaveBeenCalledWith(0.4, expect.objectContaining({ end: 'tab' }));
  });

  it('needs a label, an invalid message and a finite starting value', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgInlineNumberEditor label="" defaultValue={1} invalidMessage="x" onCommit={() => undefined} />)).toThrow(/label/u);
    expect(() => render(<CgInlineNumberEditor label="x" defaultValue={1} invalidMessage=" " onCommit={() => undefined} />)).toThrow(/invalidMessage/u);
    expect(() => render(<CgInlineNumberEditor label="x" defaultValue={Number.NaN} invalidMessage="x" onCommit={() => undefined} />)).toThrow(RangeError);
  });
});
