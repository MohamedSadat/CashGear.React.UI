import { createRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgTextBox } from '../src';

describe('CgTextBox', () => {
  it('supports controlled and uncontrolled drafts, raw native changes, and debounce rescheduling', () => {
    vi.useFakeTimers();
    const nativeChange = vi.fn();
    const committed = vi.fn();
    render(<CgTextBox aria-label="Name" defaultValue="start" commitMode="debounced" debounceMs={50} onChange={nativeChange} onValueChange={committed} />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(input, { target: { value: 'first' } });
    act(() => vi.advanceTimersByTime(25));
    fireEvent.change(input, { target: { value: 'second' } });
    act(() => vi.advanceTimersByTime(49));
    expect(committed).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(nativeChange).toHaveBeenCalledTimes(2);
    expect(committed).toHaveBeenLastCalledWith('second', expect.objectContaining({ reason: 'debounce' }));
    vi.useRealTimers();

    function Controlled() {
      const [value, setValue] = useState('old');
      return <><CgTextBox aria-label="Controlled" value={value} onValueChange={setValue} /><button onClick={() => setValue('external')}>External</button></>;
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'External' }));
    expect(screen.getByRole('textbox', { name: 'Controlled' })).toHaveValue('external');
  });

  it('preserves composition drafts and cancels a delayed commit on an external update', () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    const { rerender } = render(<CgTextBox aria-label="IME" value="base" commitMode="debounced" debounceMs={50} onValueChange={changed} />);
    const input = screen.getByRole('textbox', { name: 'IME' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'あ' } });
    rerender(<CgTextBox aria-label="IME" value="server" commitMode="debounced" debounceMs={50} onValueChange={changed} />);
    expect(input).toHaveValue('あ');
    fireEvent.compositionEnd(input, { data: 'あ' });
    expect(input).toHaveValue('server');
    act(() => vi.runAllTimers());
    expect(changed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('supports external native form submission/reset, refs, clear, reveal, and validation', async () => {
    const ref = createRef<HTMLInputElement>();
    const changes = vi.fn();
    render(<><form id="editor-form" /><CgField label="Secret" errorMessage="Invalid"><CgTextBox ref={ref} form="editor-form" name="secret" defaultValue="old" type="password" passwordReveal clearButton="always" required onValueChange={changes} /></CgField></>);
    const input = screen.getByLabelText('Secret');
    expect(ref.current).toBe(input);
    expect(new FormData(document.querySelector('form')!).get('secret')).toBe('old');
    fireEvent.change(input, { target: { value: 'changed' } });
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(input).toHaveValue('old');
    expect(changes).toHaveBeenLastCalledWith('old', expect.objectContaining({ reason: 'reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects negative debounce values', () => {
    expect(() => render(<CgTextBox debounceMs={-1} />)).toThrow(/debounceMs/);
  });
});
