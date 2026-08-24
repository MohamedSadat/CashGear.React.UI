import { createRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgCheckBox, CgRadio, CgRadioGroup, CgSwitch } from '../src';

describe('choice controls', () => {
  it('cycles an uncontrolled mixed checkbox and restores it through an external form', async () => {
    const changed = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<><form id="choice-form" /><CgCheckBox ref={ref} form="choice-form" name="approved" value="yes" label="Approve" defaultChecked="indeterminate" cycleIndeterminate required validationState="error" onCheckedChange={changed} /></>);
    const checkbox = screen.getByRole('checkbox', { name: 'Approve' });
    expect(ref.current).toBe(checkbox);
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(new FormData(document.querySelector('form')!).get('approved')).toBe('yes');
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps controlled switches controlled and suppresses read-only or disabled activation', async () => {
    const changed = vi.fn();
    function Controlled() {
      const [checked, setChecked] = useState(true);
      return <CgSwitch label="Live" checked={checked} onCheckedChange={(next, event) => { changed(next, event); setChecked(next); }} />;
    }
    render(<><Controlled /><CgSwitch label="Read only" defaultChecked readOnly /><CgSwitch label="Disabled" disabled /></>);
    fireEvent.click(screen.getByRole('switch', { name: 'Live' }));
    expect(changed).toHaveBeenCalledWith(false, expect.anything());
    const readOnly = screen.getByRole('switch', { name: 'Read only' });
    fireEvent.click(readOnly);
    await act(async () => Promise.resolve());
    expect(readOnly).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Disabled' })).toBeDisabled();
  });

  it('uses native grouping for standalone uncontrolled radios across rerenders and reset', async () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(<><form id="radio-form" /><CgRadio form="radio-form" name="shipping" value="sea" label="Sea" defaultChecked /><CgRadio ref={ref} form="radio-form" name="shipping" value="air" label="Air" /></>);
    const sea = screen.getByRole('radio', { name: 'Sea' });
    const air = screen.getByRole('radio', { name: 'Air' });
    fireEvent.click(air);
    expect(air).toBeChecked();
    expect(sea).not.toBeChecked();
    rerender(<><form id="radio-form" /><CgRadio form="radio-form" name="shipping" value="sea" label="Sea" defaultChecked /><CgRadio ref={ref} form="radio-form" name="shipping" value="air" label="Air" /></>);
    expect(air).toBeChecked();
    expect(new FormData(document.querySelector('form')!).get('shipping')).toBe('air');
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(sea).toBeChecked();
    expect(air).not.toBeChecked();
    expect(ref.current).toBe(air);
  });

  it('clears a RadioGroup without a default on reset and skips disabled options in RTL', async () => {
    const changed = vi.fn();
    const ref = createRef<HTMLFieldSetElement>();
    render(<><form id="group-form" /><CgRadioGroup ref={ref} form="group-form" name="priority" legend="Priority" direction="rtl" orientation="horizontal" required validationState="error" options={[{ value: 1, label: 'Low' }, { value: 2, label: 'Normal', disabled: true }, { value: 3, label: 'High' }]} onValueChange={changed} /></>);
    const low = screen.getByRole('radio', { name: 'Low' });
    fireEvent.click(low);
    expect(new FormData(document.querySelector('form')!).get('priority')).toBe('1');
    fireEvent.keyDown(low, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(ref.current).toHaveAttribute('aria-invalid', 'true');
  });

  it('restores controlled choice DOM state after native reset', async () => {
    render(<form><CgCheckBox label="Controlled check" checked /><CgSwitch label="Controlled switch" checked /><CgRadio name="c" value="a" label="Controlled radio" checked /><button type="reset">Reset</button></form>);
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(screen.getByRole('checkbox', { name: 'Controlled check' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Controlled switch' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Controlled radio' })).toBeChecked();
  });
});
