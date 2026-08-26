import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgMaskedInput } from '../src';
import {
  compileMask,
  displayMaskState,
  maskCaretPosition,
  maskFormattedValue,
  maskIsComplete,
  maskIsValid,
  maskRawValue,
  maskStateFromSlots,
  normalizeMaskValue,
} from '../src/internal/mask';

function paste(input: HTMLInputElement, text: string): void {
  fireEvent.paste(input, { clipboardData: { getData: () => text, setData: vi.fn() } });
}

describe('CgMaskedInput mask engine', () => {
  it('compiles required, optional, escaped, and literal tokens by Unicode code point', () => {
    const definition = compileMask(String.raw`0\9L\lA\a*\?\0\\-9la?`);
    expect(definition.tokens).toHaveLength(15);
    expect(definition.editableCount).toBe(8);
    expect(definition.tokens[0]).toMatchObject({ kind: 'digit', required: true });
    expect(definition.tokens[1]).toMatchObject({ kind: 'literal', text: '9' });
    expect(definition.tokens[9]).toMatchObject({ kind: 'literal', text: '\\' });
    expect(definition.editableTokens.slice(4).every((token) => !token.required)).toBe(true);
  });

  it('normalizes raw and formatted Unicode values while preserving invalid external evidence', () => {
    const phone = compileMask('(000) 000-0000');
    const raw = normalizeMaskValue(phone, '_', '٠١٠١٢٣٤٥٦٧');
    const formatted = normalizeMaskValue(phone, '_', '(٠١٠) ١٢٣-٤٥٦٧');
    expect(raw.slots).toEqual(formatted.slots);
    expect(maskFormattedValue(phone, raw)).toBe('(٠١٠) ١٢٣-٤٥٦٧');
    expect(maskIsComplete(phone, raw)).toBe(true);

    const positional = normalizeMaskValue(compileMask('0L'), '_', 'A1');
    expect(positional.invalidExternal).toBe(true);
    expect(positional.issues.map((issue) => issue.kind)).toEqual(['misplaced', 'extra']);
    expect(maskIsValid(compileMask('0L'), positional, false, true)).toBe(false);
  });

  it('keeps prompts display-only, compact literals and holes stable, and maps UTF-16 carets', () => {
    const compactDefinition = compileMask('09-00');
    const compact = maskStateFromSlots(compactDefinition, '_', ['1', null, '2', '3']);
    expect(maskRawValue(compact)).toBe('123');
    expect(maskFormattedValue(compactDefinition, compact)).toBe('1-23');
    expect(displayMaskState(compactDefinition, compact, '_', 'never', false).text).toBe('1 -23');
    expect(displayMaskState(compactDefinition, compact, '_', 'always', false).text).toBe('1_-23');

    const unicodeDefinition = compileMask('L0');
    const unicode = maskStateFromSlots(unicodeDefinition, '_', ['𐐀', '١']);
    const display = displayMaskState(unicodeDefinition, unicode, '_', 'always', true);
    expect(display.text).toBe('𐐀١');
    expect(display.entries[1]?.start).toBe(2);
    expect(maskCaretPosition(display, unicode, 1)).toBe(2);
  });

  it('rejects malformed masks and prompt characters', () => {
    expect(() => compileMask('')).toThrow(/nonempty mask/);
    expect(() => compileMask('00\\')).toThrow(/cannot end with an escape/);
    expect(() => render(<CgMaskedInput mask="00" promptCharacter="\n" />)).toThrow(/visible Unicode character/);
  });
});

describe('CgMaskedInput', () => {
  it('implements always, on-focus, and never display modes without binding prompts', () => {
    render(
      <>
        <CgMaskedInput aria-label="Always mode" mask="00-00" defaultValue="12" showMask="always" />
        <CgMaskedInput aria-label="Focus mode" mask="00-00" defaultValue="12" showMask="onFocus" />
        <CgMaskedInput aria-label="Never mode" mask="00-00" defaultValue="12" showMask="never" />
        <CgMaskedInput aria-label="Placeholder mode" mask="00" showMask="never" placeholder="Enter code" />
      </>,
    );
    expect(screen.getByLabelText('Always mode')).toHaveValue('12-__');
    const focusMode = screen.getByLabelText('Focus mode');
    expect(focusMode).toHaveValue('12-');
    fireEvent.focus(focusMode);
    expect(focusMode).toHaveValue('12-__');
    expect(screen.getByLabelText('Never mode')).toHaveValue('12-');
    expect(screen.getByLabelText('Placeholder mode')).toHaveAttribute('placeholder', 'Enter code');
    expect(screen.getByLabelText('Placeholder mode')).toHaveValue('');
  });

  it('edits by slot, emits formatted or raw values, and reports real completion transitions', async () => {
    const values = vi.fn();
    const complete = vi.fn();
    const incomplete = vi.fn();
    render(
      <CgMaskedInput
        mask="000-99"
        defaultValue="12"
        showMask="always"
        includeLiterals
        onValueChange={values}
        onComplete={complete}
        onIncomplete={incomplete}
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);
    paste(input, '3');
    await waitFor(() => expect(values).toHaveBeenLastCalledWith('123-', expect.objectContaining({ reason: 'paste', rawValue: '123', isComplete: true })));
    expect(complete).toHaveBeenCalledOnce();

    await waitFor(() => expect(input.selectionStart).toBe(4));
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(values).toHaveBeenLastCalledWith('12', expect.objectContaining({ reason: 'delete', isComplete: false }));
    expect(incomplete).toHaveBeenCalledOnce();
  });

  it('restores rejected controlled edits and recognizes normalized controlled acceptance without prop-only semantics', async () => {
    const rejectedChange = vi.fn();
    const { rerender } = render(<CgMaskedInput mask="000" value="12" showMask="always" onValueChange={rejectedChange} />);
    const rejected = screen.getByRole('textbox') as HTMLInputElement;
    rejected.focus();
    rejected.setSelectionRange(2, 2);
    paste(rejected, '3');
    expect(rejectedChange).toHaveBeenCalledWith('123', expect.objectContaining({ isComplete: true }));
    await waitFor(() => expect(rejected).toHaveValue('12_'));

    const propOnlyComplete = vi.fn();
    rerender(<CgMaskedInput mask="000" value="123" showMask="always" onComplete={propOnlyComplete} />);
    expect(propOnlyComplete).not.toHaveBeenCalled();

    const acceptedComplete = vi.fn();
    function Accepted() {
      const [value, setValue] = useState('12');
      return <CgMaskedInput mask="000" value={value} showMask="always" onValueChange={setValue} onComplete={acceptedComplete} />;
    }
    render(<Accepted />);
    const accepted = screen.getAllByRole('textbox')[1] as HTMLInputElement;
    accepted.focus();
    accepted.setSelectionRange(2, 2);
    paste(accepted, '3');
    await waitFor(() => expect(accepted).toHaveValue('123'));
    expect(acceptedComplete).toHaveBeenCalledOnce();
  });

  it('preserves native callbacks and adds rich commit and masked focus callbacks', () => {
    const nativeChange = vi.fn();
    const nativeFocus = vi.fn();
    const nativeBlur = vi.fn();
    const maskedFocus = vi.fn();
    const maskedBlur = vi.fn();
    const committed = vi.fn();
    render(
      <CgMaskedInput
        mask="00-00"
        defaultValue="12"
        onChange={nativeChange}
        onFocus={nativeFocus}
        onBlur={nativeBlur}
        onMaskedFocus={maskedFocus}
        onMaskedBlur={maskedBlur}
        onValueCommitted={committed}
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1234' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(nativeChange).toHaveBeenCalledOnce();
    expect(nativeFocus).toHaveBeenCalledOnce();
    expect(nativeBlur).toHaveBeenCalledOnce();
    expect(maskedFocus).toHaveBeenCalledWith(expect.objectContaining({ reason: 'focus', rawValue: '12' }));
    expect(maskedBlur).toHaveBeenCalledWith(expect.objectContaining({ reason: 'blur' }));
    expect(committed).toHaveBeenCalledWith('12-34', expect.objectContaining({ reason: 'enter', isComplete: true }));
    expect(committed).toHaveBeenCalledWith('12-34', expect.objectContaining({ reason: 'blur', isComplete: true }));
  });

  it('handles selection replacement, Delete, cut, Home, End, and arrow navigation', async () => {
    const values = vi.fn();
    const clipboardSet = vi.fn();
    render(<CgMaskedInput mask="00-00" defaultValue="1234" showMask="always" onValueChange={values} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 2);
    paste(input, '98');
    expect(input).toHaveValue('98-34');

    input.setSelectionRange(0, 0);
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(input).toHaveValue('_8-34');
    input.setSelectionRange(1, 2);
    fireEvent.cut(input, { clipboardData: { getData: vi.fn(), setData: clipboardSet } });
    expect(clipboardSet).toHaveBeenCalledWith('text/plain', '8');
    expect(input).toHaveValue('__-34');

    fireEvent.keyDown(input, { key: 'End' });
    await waitFor(() => expect(input.selectionStart).toBe(0));
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    await waitFor(() => expect(input.selectionStart).toBe(1));
    fireEvent.keyDown(input, { key: 'Home' });
    await waitFor(() => expect(input.selectionStart).toBe(0));
    expect(values).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reason: 'cut' }));
  });

  it('submits only committed values through an external form, validates, resets, and excludes disabled values', async () => {
    const changes = vi.fn();
    render(
      <>
        <form id="external-mask-form" data-testid="external-form" />
        <CgMaskedInput mask="000-00" name="code" form="external-mask-form" defaultValue="12" includeLiterals={false} onValueChange={changes} required />
        <CgMaskedInput mask="00" name="disabled-code" form="external-mask-form" defaultValue="99" disabled />
      </>,
    );
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const input = inputs[0]!;
    expect(input.checkValidity()).toBe(false);
    input.focus();
    input.setSelectionRange(2, 2);
    paste(input, '345');
    await waitFor(() => expect(input.checkValidity()).toBe(true));
    const form = screen.getByTestId('external-form') as HTMLFormElement;
    expect(new FormData(form).get('code')).toBe('12345');
    expect(new FormData(form).has('disabled-code')).toBe(false);

    act(() => form.reset());
    await waitFor(() => expect(input).toHaveValue('12_-__'));
    expect(changes).toHaveBeenLastCalledWith('12', expect.objectContaining({ reason: 'reset' }));
  });

  it('composes internal validation descriptions with CgField and transfers invalid focus', () => {
    const invalid = vi.fn();
    render(
      <CgField label="Identifier" description="Use the issued identifier" validationMessage="Field message">
        <CgMaskedInput mask="000" defaultValue="1" required onInvalid={invalid} />
      </CgField>,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(describedBy).toHaveLength(3);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    input.blur();
    input.checkValidity();
    expect(invalid).toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('handles UTF-16 caret navigation, composition revisions, direction, density, and native refs', async () => {
    const inputRef = createRef<HTMLInputElement>();
    const change = vi.fn();
    const { rerender } = render(
      <CgMaskedInput ref={inputRef} mask="L0" defaultValue="𐐀١" showMask="always" direction="rtl" density="compact" onValueChange={change} />,
    );
    const input = inputRef.current!;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('dir', 'rtl');
    expect(input?.closest('[data-density]')).toHaveAttribute('data-density', 'compact');
    input.focus();
    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(change).toHaveBeenCalledWith('𐐀', expect.objectContaining({ rawValue: '𐐀' }));
    await waitFor(() => expect(input.selectionStart).toBe(2));
    fireEvent.compositionStart(input);
    rerender(<CgMaskedInput ref={inputRef} mask="LL" value="AB" showMask="always" direction="rtl" density="compact" onValueChange={change} />);
    fireEvent.compositionEnd(inputRef.current!, { data: 'C' });
    expect(change).toHaveBeenCalledTimes(1);

    rerender(<CgMaskedInput ref={inputRef} mask="LL-0" value="AB١" promptCharacter="·" showMask="always" direction="ltr" density="compact" onValueChange={change} />);
    expect(inputRef.current).toHaveAttribute('dir', 'ltr');
    expect(inputRef.current).toHaveValue('AB-١');
  });

  it('keeps prompt display out of values and renders deterministically on the server', () => {
    const markup = renderToString(<CgMaskedInput mask="00-00" showMask="always" />);
    expect(markup).toContain('value="__-__"');
    expect(markup).toContain('data-cg-masked-input');
    render(<CgMaskedInput mask="00-00" showMask="always" />);
    expect(screen.getByRole('textbox')).toHaveValue('__-__');
    expect(document.querySelector('[data-cg-masked-input-form-proxy] option')).toBeNull();
  });
});
