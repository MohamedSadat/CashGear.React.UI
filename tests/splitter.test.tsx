import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgSplitter } from '../src';
import type { CgSplitterActions, CgSplitterPaneDescriptor, CgSplitterState } from '../src';

function panes(onCollapsedChange?: CgSplitterPaneDescriptor['onCollapsedChange']): ReadonlyArray<CgSplitterPaneDescriptor> {
  return [
    {
      key: ' navigation ',
      size: '12rem',
      minimumSize: 80,
      maximumSize: 300,
      collapsible: true,
      ariaLabel: 'Navigation',
      renderHeader: () => <h2>Navigation header</h2>,
      renderContent: ({ collapsed }) => <button>Navigation {String(collapsed)}</button>,
      renderCollapsed: () => <button>Open navigation</button>,
      onCollapsedChange,
      dataAttributes: { 'data-testid': 'navigation-pane' },
    },
    { key: 'content', size: '2*', minimumSize: 120, ariaLabel: 'Content', renderContent: () => <input aria-label="Content input" /> },
    { key: 'hidden', visible: false, renderContent: () => 'Hidden pane' },
  ];
}

function mockPairGeometry(): void {
  const paneElements = screen.getAllByRole('region');
  vi.spyOn(paneElements[0]!, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, toJSON: () => ({}) });
  vi.spyOn(paneElements[1]!, 'getBoundingClientRect').mockReturnValue({ x: 208, y: 0, left: 208, top: 0, width: 300, height: 100, right: 508, bottom: 100, toJSON: () => ({}) });
}

describe('CgSplitter', () => {
  it('rejects invalid component configuration at the boundary', () => {
    expect(() => render(<CgSplitter panes={panes()} orientation={'diagonal' as 'horizontal'} />)).toThrow(/orientation/u);
    expect(() => render(<CgSplitter panes={panes()} resizeMode={'instant' as 'live'} />)).toThrow(/resizeMode/u);
    expect(() => render(<CgSplitter panes={panes()} keyboardStep={0} />)).toThrow(/keyboardStep/u);
    expect(() => render(<CgSplitter panes={panes()} resizeNotificationInterval={-1} />)).toThrow(/resizeNotificationInterval/u);
    expect(() => render(<CgSplitter panes={panes()} gutterSize="1fr" />)).toThrow(/gutterSize/u);
    expect(() => render(<CgSplitter panes={panes()} aria-label=" " />)).toThrow(/nonempty aria-label/u);
  });

  it('renders an SSR-safe labelled group with direct panes and an accessible separator', () => {
    const html = renderToString(<CgSplitter panes={panes()} aria-label="Workspace splitter" />);
    expect(html).toContain('role="group"');
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).not.toContain('Hidden pane');

    render(<CgSplitter panes={panes()} aria-label="Workspace splitter" />);
    expect(screen.getByRole('group', { name: 'Workspace splitter' })).toHaveAttribute('data-resize-mode', 'live');
    expect(screen.getAllByRole('region')).toHaveLength(2);
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-controls', expect.stringContaining('pane-1'));
    expect(separator).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTestId('navigation-pane')).toHaveAttribute('data-cg-collapsible', 'true');
  });

  it('hydrates its server markup without replacing pane nodes', async () => {
    const element = <CgSplitter panes={panes()} id="hydrated-splitter" aria-label="Hydrated splitter" />;
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.append(container);
    const firstPane = container.querySelector('[data-cg-splitter-pane="navigation"]');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = hydrateRoot(container, element);
    await act(async () => Promise.resolve());
    expect(container.querySelector('[data-cg-splitter-pane="navigation"]')).toBe(firstPane);
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/hydration|did not match/u);
    act(() => root.unmount());
    error.mockRestore();
    container.remove();
  });

  it('exposes frozen action state and applies collapse callbacks in descriptor/state/terminal order', () => {
    const order: string[] = [];
    const actions = createRef<CgSplitterActions>();
    render(<CgSplitter
      panes={panes(() => order.push('descriptor'))}
      actionsRef={actions}
      onStateChange={(state, details) => {
        order.push('state');
        expect(Object.isFrozen(state)).toBe(true);
        expect(Object.isFrozen(details)).toBe(true);
      }}
      onPaneCollapsed={(details) => {
        order.push('terminal');
        expect(Object.isFrozen(details)).toBe(true);
      }}
    />);
    act(() => expect(actions.current?.collapsePane(' navigation ')).toBe(true));
    expect(order).toEqual(['descriptor', 'state', 'terminal']);
    expect(screen.getByText('Open navigation')).toBeInTheDocument();
    expect(screen.queryByText('Navigation false')).not.toBeInTheDocument();
    expect(actions.current?.getState().collapsedPaneKeys).toEqual(['navigation']);
    expect(Object.isFrozen(actions.current?.getState())).toBe(true);
    act(() => expect(actions.current?.expandPane('navigation')).toBe(true));
    expect(screen.getByText('Navigation false')).toBeInTheDocument();
  });

  it('emits controlled proposals while preserving authoritative state', async () => {
    const actions = createRef<CgSplitterActions>();
    const change = vi.fn();
    const authoritative: CgSplitterState = Object.freeze({
      version: 1,
      panes: Object.freeze([{ key: 'navigation', size: '192px' }, { key: 'content', size: '2fr' }, { key: 'hidden', size: '1fr' }]),
      collapsedPaneKeys: Object.freeze([]),
    });
    render(<CgSplitter panes={panes()} state={authoritative} actionsRef={actions} onStateChange={change} />);
    expect(actions.current?.collapsePane('navigation')).toBe(true);
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ collapsedPaneKeys: ['navigation'] }), expect.objectContaining({ operation: 'collapse' }));
    await act(async () => Promise.resolve());
    expect(actions.current?.getState().collapsedPaneKeys).toEqual([]);
    expect(screen.getByText('Navigation false')).toBeInTheDocument();
  });

  it('supports programmatic sizing, focus, reset, and disabled/read-only rejection', () => {
    const actions = createRef<CgSplitterActions>();
    const resized = vi.fn();
    const { rerender } = render(<CgSplitter panes={panes()} actionsRef={actions} onPaneResized={resized} />);
    expect(actions.current?.setPaneSize('navigation', 240)).toBe(true);
    expect(actions.current?.getState().panes[0]?.size).toBe('240px');
    expect(resized).toHaveBeenCalledWith(expect.objectContaining({ reason: 'programmatic', startPaneSizePixels: null }));
    expect(actions.current?.focusSeparator('navigation', 'content')).toBe(true);
    expect(screen.getByRole('separator')).toHaveFocus();
    actions.current?.focus();
    expect(screen.getByRole('group')).toHaveFocus();
    expect(actions.current?.reset()).toBe(true);
    expect(actions.current?.getState().panes[0]?.size).toBe('12rem');

    rerender(<CgSplitter panes={panes()} actionsRef={actions} disabled />);
    expect(actions.current?.setPaneSize('navigation', 200)).toBe(false);
    rerender(<CgSplitter panes={panes()} actionsRef={actions} readOnly />);
    expect(actions.current?.collapsePane('navigation')).toBe(false);
    expect(screen.getByRole('separator')).toHaveAttribute('tabindex', '-1');
  });

  it('rejects invalid action targets and prevents collapsing the final visible pane', () => {
    const actions = createRef<CgSplitterActions>();
    render(<CgSplitter actionsRef={actions} panes={[
      { key: 'first', collapsible: true, renderContent: () => 'First' },
      { key: 'second', collapsible: true, renderContent: () => 'Second' },
    ]} />);
    expect(() => actions.current?.setPaneSize('missing', 20)).toThrow(/does not exist/u);
    expect(() => actions.current?.setPaneSize('first', 'auto')).toThrow(/CSS length/u);
    act(() => expect(actions.current?.collapsePane('first')).toBe(true));
    expect(() => actions.current?.collapsePane('second')).toThrow(/remain expanded/u);
  });

  it('commits invariant pixels for keyboard resizing and honors physical RTL arrows', async () => {
    const actions = createRef<CgSplitterActions>();
    const stateChange = vi.fn();
    const resizing = vi.fn();
    const resized = vi.fn();
    const { rerender } = render(<CgSplitter panes={panes()} actionsRef={actions} resizeNotificationInterval={0} onStateChange={stateChange} onPaneResizing={resizing} onPaneResized={resized} />);
    mockPairGeometry();
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(resizing).toHaveBeenCalledOnce();
    expect(stateChange).toHaveBeenCalledWith(expect.objectContaining({ panes: expect.arrayContaining([{ key: 'navigation', size: '210px' }, { key: 'content', size: '290px' }]) }), expect.objectContaining({ reason: 'keyboard' }));
    expect(resized).toHaveBeenCalledWith(expect.objectContaining({ startPaneSizePixels: 210, endPaneSizePixels: 290 }));

    stateChange.mockClear();
    rerender(<CgSplitter panes={panes()} direction="rtl" actionsRef={actions} onStateChange={stateChange} />);
    mockPairGeometry();
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(stateChange).toHaveBeenCalledWith(expect.objectContaining({ panes: expect.arrayContaining([{ key: 'navigation', size: '190px' }]) }), expect.anything());
    await waitFor(() => expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow'));
  });

  it('retains deferred pointer preview until commit and cancels on pointer cancellation', () => {
    const changed = vi.fn();
    render(<CgSplitter panes={panes()} resizeMode="deferred" resizeNotificationInterval={0} onStateChange={changed} />);
    mockPairGeometry();
    const separator = screen.getByRole('separator') as HTMLElement & {
      setPointerCapture: (pointerId: number) => void;
      hasPointerCapture: (pointerId: number) => boolean;
      releasePointerCapture: (pointerId: number) => void;
    };
    separator.setPointerCapture = vi.fn();
    separator.hasPointerCapture = vi.fn(() => true);
    separator.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(separator, { pointerId: 4, button: 0, clientX: 200 });
    fireEvent.pointerMove(separator, { pointerId: 4, clientX: 230 });
    expect(changed).not.toHaveBeenCalled();
    expect(document.querySelector('[data-cg-splitter-preview]')).toHaveAttribute('data-cg-visible');
    fireEvent.pointerCancel(separator, { pointerId: 4 });
    expect(changed).not.toHaveBeenCalled();
    expect(document.querySelector('[data-cg-splitter-preview]')).not.toHaveAttribute('data-cg-visible');
  });

  it('mounts cleanly in Strict Mode and enforces collapse invariants', () => {
    const actions = createRef<CgSplitterActions>();
    const { unmount } = render(<StrictMode><CgSplitter panes={panes()} actionsRef={actions} /></StrictMode>);
    act(() => expect(actions.current?.collapsePane('navigation')).toBe(true));
    expect(() => actions.current?.collapsePane('content')).toThrow(/not collapsible/u);
    unmount();
    expect(actions.current).toBeNull();
  });
});
