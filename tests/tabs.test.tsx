import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgTabs } from '../src';
import type { CgTabDescriptor, CgTabsActions } from '../src';

const tabs: ReadonlyArray<CgTabDescriptor> = [
  { key: 'one', text: 'One', content: <span>First panel</span>, closable: true },
  { key: 'two', text: 'Two', content: <span>Second panel</span> },
  { key: 'disabled', text: 'Disabled', disabled: true, content: 'Disabled panel' },
];

describe('CgTabs', () => {
  it('renders linked tab semantics and supports manual keyboard activation', async () => {
    const changed = vi.fn();
    render(<CgTabs tabs={tabs} defaultActiveKey="one" onActiveKeyChange={changed} />);
    const first = screen.getByRole('tab', { name: 'One' });
    const second = screen.getByRole('tab', { name: 'Two' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    expect(first).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(changed.mock.calls[0]?.[1]).toMatchObject({ previousIndex: 0, activeIndex: 1, source: 'keyboard' });
  });

  it('preserves keyed selection through reorder and corrects removal forward then backward', () => {
    const changed = vi.fn();
    const view = render(<CgTabs tabs={tabs} defaultActiveKey="two" onActiveKeyChange={changed} />);
    view.rerender(<CgTabs tabs={[tabs[1]!, tabs[0]!, tabs[2]!]} defaultActiveKey="two" onActiveKeyChange={changed} />);
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(changed).not.toHaveBeenCalled();
    view.rerender(<CgTabs tabs={[tabs[0]!, tabs[2]!]} defaultActiveKey="two" onActiveKeyChange={changed} />);
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    expect(changed).toHaveBeenCalledWith('one', expect.objectContaining({ isUserInitiated: false, source: 'collection' }));
  });

  it('keeps controlled parents authoritative', () => {
    render(<CgTabs tabs={tabs} activeKey="one" onActiveKeyChange={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
  });

  it('implements all content lifecycles', () => {
    const active = render(<CgTabs tabs={tabs} defaultActiveKey="one" contentMode="active-only" />);
    expect(screen.queryByText('Second panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.queryByText('First panel')).not.toBeInTheDocument();
    active.unmount();
    render(<CgTabs tabs={tabs} defaultActiveKey="one" contentMode="all" />);
    expect(screen.getByText('Second panel').closest('[role=tabpanel]')).toHaveAttribute('hidden');
  });

  it('retains on-demand content after first activation', () => {
    render(<CgTabs tabs={tabs} defaultActiveKey="one" contentMode="on-demand" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByText('First panel').closest('[role=tabpanel]')).toHaveAttribute('hidden');
  });

  it('runs abortable close requests and never removes a descriptor itself', async () => {
    let release: ((value: boolean) => void) | undefined;
    const requested = vi.fn();
    render(<CgTabs tabs={tabs} beforeClose={({ signal }) => new Promise<boolean>((resolve) => { release = resolve; signal.addEventListener('abort', () => resolve(false)); })} onCloseRequest={requested} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close One' }));
    await act(async () => { release?.(true); await Promise.resolve(); });
    expect(requested).toHaveBeenCalledOnce();
    expect(screen.getByRole('tab', { name: 'One' })).toBeInTheDocument();
  });

  it('exposes actions and stable SSR markup', () => {
    const actions = createRef<CgTabsActions>();
    render(<CgTabs tabs={tabs} actionsRef={actions} />);
    act(() => actions.current?.focusTab('two'));
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    act(() => { actions.current?.activateTab('two'); });
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(renderToString(<CgTabs tabs={tabs} />)).toContain('role="tablist"');
  });

  it('supports parent-owned collection updates', async () => {
    function Owner() {
      const [items, setItems] = useState(tabs);
      return <CgTabs tabs={items} onCloseRequest={({ key }) => setItems((current) => current.filter((tab) => tab.key !== key))} />;
    }
    render(<Owner />);
    fireEvent.click(screen.getByRole('button', { name: 'Close One' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'One' })).not.toBeInTheDocument());
  });

  it('rejects missing and duplicate keys', () => {
    expect(() => render(<CgTabs tabs={[{ key: '', text: 'Empty' }]} />)).toThrow(/nonempty key/);
    expect(() => render(<CgTabs tabs={[{ key: 'a', text: 'A' }, { key: 'a', text: 'Again' }]} />)).toThrow(/duplicate key/);
  });
});
