import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgStepper } from '../src';
import type { CgStepDescriptor, CgStepperActions } from '../src';

const steps: ReadonlyArray<CgStepDescriptor> = [
  { key: 'one', label: 'One', content: 'First' },
  { key: 'skip', label: 'Skipped', skipped: true },
  { key: 'two', label: 'Two', content: 'Second' },
  { key: 'disabled', label: 'Disabled', disabled: true },
];

describe('CgStepper', () => {
  it('renders an ordered progress structure and active content', () => {
    render(<CgStepper steps={steps} defaultSelectedKey="one" renderActiveContent />);
    expect(screen.getByRole('navigation', { name: 'Progress' }).querySelector('ol')).not.toBeNull();
    expect(screen.getByRole('button', { name: /One/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('region')).toHaveTextContent('First');
  });

  it('runs guards and callbacks in order while skipping unavailable gaps', async () => {
    const order: string[] = [];
    const guarded: ReadonlyArray<CgStepDescriptor> = [
      { key: 'one', label: 'One', canLeave: () => { order.push('leave'); } },
      { key: 'skip', label: 'Skip', skipped: true },
      { key: 'two', label: 'Two', canEnter: () => { order.push('enter'); } },
    ];
    render(<CgStepper steps={guarded} defaultSelectedKey="one" beforeSelectionChange={() => { order.push('before'); }} onSelectedKeyChange={() => { order.push('change'); }} afterSelectionChange={() => { order.push('after'); }} />);
    fireEvent.click(screen.getByRole('button', { name: /Two/ }));
    await act(async () => Promise.resolve());
    expect(order).toEqual(['leave', 'enter', 'before', 'change', 'after']);
  });

  it('cancels and supersedes stale async navigation', async () => {
    const signals: AbortSignal[] = [];
    let call = 0;
    const changed = vi.fn();
    render(<CgStepper steps={[{ key: 'one', label: 'One', canLeave: (details) => { signals.push(details.signal); call += 1; return call === 1 ? new Promise<boolean>(() => undefined) : true; } }, { key: 'two', label: 'Two' }, { key: 'three', label: 'Three' }]} defaultSelectedKey="one" linear={false} onSelectedKeyChange={changed} />);
    fireEvent.click(screen.getByRole('button', { name: /Two/ }));
    fireEvent.click(screen.getByRole('button', { name: /Three/ }));
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => Promise.resolve());
    expect(changed).not.toHaveBeenCalledWith('two', expect.anything());
  });

  it('keeps controlled selection authoritative', async () => {
    render(<CgStepper steps={steps} selectedKey="one" onSelectedKeyChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Two/ }));
    await act(async () => Promise.resolve());
    expect(screen.getByRole('button', { name: /One/ })).toHaveAttribute('aria-current', 'step');
  });

  it('reconciles removal to the previous available step', () => {
    const changed = vi.fn();
    const view = render(<CgStepper steps={steps} defaultSelectedKey="two" onSelectedKeyChange={changed} />);
    view.rerender(<CgStepper steps={[steps[0]!, steps[1]!, steps[3]!]} defaultSelectedKey="two" onSelectedKeyChange={changed} />);
    expect(screen.getByRole('button', { name: /One/ })).toHaveAttribute('aria-current', 'step');
    expect(changed).toHaveBeenCalledWith('one', expect.objectContaining({ source: 'collection', isUserInitiated: false }));
  });

  it('uses roving focus and RTL arrows', async () => {
    render(<CgStepper steps={steps} direction="rtl" linear={false} />);
    const first = screen.getByRole('button', { name: /One/ });
    const second = screen.getByRole('button', { name: /Two/ });
    first.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(second).toHaveFocus();
  });

  it('exposes navigation actions', async () => {
    const actions = createRef<CgStepperActions>();
    render(<CgStepper steps={steps} actionsRef={actions} />);
    await act(async () => { await actions.current?.next(); });
    expect(screen.getByRole('button', { name: /Two/ })).toHaveAttribute('aria-current', 'step');
    await act(async () => { await actions.current?.previous(); });
    expect(screen.getByRole('button', { name: /One/ })).toHaveAttribute('aria-current', 'step');
  });

  it('rejects invalid descriptors', () => {
    expect(() => render(<CgStepper steps={[{ key: 'x', label: '' }]} />)).toThrow(/nonempty label/);
    expect(() => render(<CgStepper steps={[{ key: 'x', label: 'X' }, { key: 'x', label: 'Again' }]} />)).toThrow(/duplicate key/);
  });
});
