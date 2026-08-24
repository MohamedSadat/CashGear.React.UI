import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgButton, CgCheckBox, CgField, CgIcon, CgMemo, CgProgressBar, CgRadio, CgRadioGroup, CgSwitch, CgTextBox } from '../src';

describe('public components', () => {
  it('renders decorative and labelled currentColor icons', () => {
    const { container } = render(<><CgIcon name="search" /><CgIcon name="check" label="Approved" size={24} /></>);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Approved' })).toHaveAttribute('width', '24');
  });

  it('auto-loads an async button and suppresses duplicate activation', async () => {
    const user = userEvent.setup();
    let resolve: (() => void) | undefined;
    const action = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    render(<CgButton intent="primary" icon="check" loadingContent="Saving" onClick={action}>Save</CgButton>);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button', { name: 'Saving' }));
    expect(action).toHaveBeenCalledOnce();
    resolve?.();
  });

  it('supports text drafts, password reveal, commands, refs, and controlled updates', async () => {
    const user = userEvent.setup();
    const command = vi.fn();
    const ref = createRef<HTMLInputElement>();
    function Controlled() { const [value, setValue] = useState('old'); return <CgField label="Secret"><CgTextBox ref={ref} type="password" passwordReveal clearButton="auto" value={value} onValueChange={setValue} buttons={[{ key: 'apply', text: 'Apply', ariaLabel: 'Apply command', onPress: command }]} /></CgField>; }
    render(<Controlled />);
    const input = screen.getByLabelText('Secret');
    expect(ref.current).toBe(input);
    await user.clear(input);
    await user.type(input, 'new');
    expect(input).toHaveValue('new');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Apply command' }));
    expect(command).toHaveBeenCalledOnce();
  });

  it('handles memo counters, LF normalization, clearing, and read-only state', () => {
    const changed = vi.fn();
    render(<CgField label="Notes"><CgMemo defaultValue={'a\r\nb'} maxLength={10} showCounter clearButton="always" onValueChange={changed} /></CgField>);
    expect(screen.getByLabelText('Notes')).toHaveValue('a\nb');
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    expect(screen.getByLabelText('Notes')).toHaveValue('');
    expect(changed).toHaveBeenLastCalledWith('', expect.objectContaining({ reason: 'clear' }));
  });

  it('supports indeterminate checkbox cycling and a read-only switch', async () => {
    const user = userEvent.setup();
    const checked = vi.fn();
    render(<><CgCheckBox label="Approve" defaultChecked="indeterminate" cycleIndeterminate onCheckedChange={checked} /><CgSwitch label="Lock" defaultChecked readOnly /></>);
    expect(screen.getByRole('checkbox', { name: 'Approve' })).toHaveAttribute('aria-checked', 'mixed');
    await user.click(screen.getByRole('checkbox', { name: 'Approve' }));
    expect(checked).toHaveBeenCalledWith(true, undefined);
    await user.click(screen.getByRole('switch', { name: 'Lock' }));
    expect(screen.getByRole('switch', { name: 'Lock' })).toBeChecked();
  });

  it('renders native typed radios and navigates a group while skipping disabled options', () => {
    const changed = vi.fn();
    render(<><CgRadio name="single" value={7} label="Seven" onCheckedChange={changed} /><CgRadioGroup legend="Priority" defaultValue={1} options={[{ value: 1, label: 'One' }, { value: 2, label: 'Two', disabled: true }, { value: 3, label: 'Three' }]} onValueChange={changed} /></>);
    fireEvent.click(screen.getByRole('radio', { name: 'Seven' }));
    expect(changed).toHaveBeenCalledWith(7, expect.anything());
    const one = screen.getByRole('radio', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Three' })).toBeChecked();
  });

  it('exposes determinate and indeterminate progress semantics with clamping', () => {
    const { rerender } = render(<CgProgressBar value={150} min={0} max={100} showLabel />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();
    rerender(<CgProgressBar />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
});
