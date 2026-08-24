import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgMemo } from '../src';

describe('CgMemo', () => {
  it('normalizes LF, counts, commits on blur, clears, and forwards a native ref', () => {
    const changed = vi.fn();
    const ref = createRef<HTMLTextAreaElement>();
    render(<CgField label="Notes"><CgMemo ref={ref} defaultValue={'a\r\nb'} commitMode="blur" maxLength={10} showCounter clearButton="always" onValueChange={changed} /></CgField>);
    const memo = screen.getByLabelText('Notes');
    expect(ref.current).toBe(memo);
    expect(memo).toHaveValue('a\nb');
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    fireEvent.change(memo, { target: { value: 'next\r\nline' } });
    expect(changed).not.toHaveBeenCalled();
    fireEvent.blur(memo);
    expect(changed).toHaveBeenLastCalledWith('next\nline', expect.objectContaining({ reason: 'blur' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    expect(memo).toHaveValue('');
  });

  it('resets through an externally associated form and preserves IME against external updates', async () => {
    const changed = vi.fn();
    const { rerender } = render(<><form id="memo-form" /><CgMemo aria-label="Memo" form="memo-form" name="memo" value="base" commitMode="debounced" onValueChange={changed} /></>);
    const memo = screen.getByRole('textbox', { name: 'Memo' });
    fireEvent.compositionStart(memo);
    fireEvent.change(memo, { target: { value: '編集中' } });
    rerender(<><form id="memo-form" /><CgMemo aria-label="Memo" form="memo-form" name="memo" value="server" commitMode="debounced" onValueChange={changed} /></>);
    expect(memo).toHaveValue('編集中');
    fireEvent.compositionEnd(memo);
    expect(memo).toHaveValue('server');
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(memo).toHaveValue('server');
  });

  it('cleans ResizeObserver and validates row/length combinations', () => {
    const disconnect = vi.fn();
    const Original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    };
    const view = render(<CgMemo aria-label="Auto" resizeMode="auto" rows={2} maxRows={4} />);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    globalThis.ResizeObserver = Original;

    expect(() => render(<CgMemo debounceMs={-1} />)).toThrow(/debounceMs/);
    expect(() => render(<CgMemo rows={0} />)).toThrow(/rows/);
    expect(() => render(<CgMemo rows={4} maxRows={3} />)).toThrow(/maxRows/);
    expect(() => render(<CgMemo maxLength={-1} />)).toThrow(/maxLength/);
  });
});
