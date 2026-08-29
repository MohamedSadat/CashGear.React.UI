import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, StrictMode, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgDrawer } from '../src';
import type { CgDrawerActions } from '../src';

function content() {
  return {
    renderHeader: () => <h2>Tools</h2>,
    renderDrawer: () => <><input aria-label="Drawer field" defaultValue="kept" /><button>Drawer action</button></>,
    renderFooter: () => <small>Drawer footer</small>,
    renderMiniDrawer: () => <button aria-label="Open tools">☰</button>,
    renderApplicationContent: () => <><button>Application action</button><input aria-label="Application field" /></>,
  };
}

describe('CgDrawer', () => {
  it('rejects invalid sizes, modes, breakpoints, identifiers, and labels', () => {
    expect(() => render(<CgDrawer mode={'dock' as 'shrink'} />)).toThrow(/mode/u);
    expect(() => render(<CgDrawer position={'center' as 'start'} />)).toThrow(/position/u);
    expect(() => render(<CgDrawer responsiveBreakpoint={0} />)).toThrow(/responsiveBreakpoint/u);
    expect(() => render(<CgDrawer openSize={0} />)).toThrow(/openSize/u);
    expect(() => render(<CgDrawer openSize="auto" />)).toThrow(/CSS length/u);
    expect(() => render(<CgDrawer openSize="10px" miniSize="20px" />)).toThrow(/miniSize/u);
    expect(() => render(<CgDrawer panelId=" " />)).toThrow(/panelId/u);
    expect(() => render(<CgDrawer aria-label=" " />)).toThrow(/nonempty aria-label/u);
  });

  it('renders one persistent SSR-safe subtree for all regions', () => {
    const html = renderToString(<CgDrawer {...content()} miniModeEnabled aria-label="Tools drawer" />);
    expect(html).toContain('data-cg-drawer-panel');
    expect(html).toContain('Drawer field');
    expect(html).toContain('Open tools');
    expect(html).toContain('Application action');
    render(<CgDrawer {...content()} miniModeEnabled aria-label="Tools drawer" />);
    expect(screen.getByRole('complementary', { name: 'Tools drawer', hidden: true })).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Tools').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Open tools' })).toBeInTheDocument();
  });

  it('hydrates its persistent server subtree without replacing form nodes', async () => {
    const element = <CgDrawer {...content()} id="hydrated-drawer" defaultOpen />;
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.append(container);
    const input = container.querySelector('[aria-label="Drawer field"]');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = hydrateRoot(container, element);
    await act(async () => Promise.resolve());
    expect(container.querySelector('[aria-label="Drawer field"]')).toBe(input);
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/hydration|did not match/u);
    act(() => root.unmount());
    error.mockRestore();
    container.remove();
  });

  it('preserves region identity, form state, and scroll state through mode and open changes', async () => {
    const actions = createRef<CgDrawerActions>();
    const { rerender } = render(<CgDrawer {...content()} defaultOpen actionsRef={actions} />);
    const drawerInput = screen.getByLabelText<HTMLInputElement>('Drawer field');
    const panel = drawerInput.closest('[data-cg-drawer-panel]');
    drawerInput.value = 'edited';
    panel!.scrollTop = 42;
    await act(() => actions.current?.close());
    rerender(<CgDrawer {...content()} mode="overlay" miniModeEnabled actionsRef={actions} />);
    expect(screen.getByLabelText('Drawer field')).toBe(drawerInput);
    expect(screen.getByLabelText<HTMLInputElement>('Drawer field')).toHaveValue('edited');
    expect(panel).toHaveProperty('scrollTop', 42);
    expect(screen.getByRole('button', { name: 'Open tools' })).toBeInTheDocument();
  });

  it('runs cancellable lifecycle callbacks in order and freezes details', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const actions = createRef<CgDrawerActions>();
    render(<CgDrawer
      {...content()}
      actionsRef={actions}
      onBeforeOpen={(details) => { order.push('before'); expect(Object.isFrozen(details)).toBe(true); }}
      onOpenChange={(_, details) => { order.push('change'); expect(Object.isFrozen(details)).toBe(true); }}
      onOpened={(details) => { order.push('terminal'); expect(Object.isFrozen(details)).toBe(true); }}
    />);
    await act(() => actions.current?.open());
    expect(order).toEqual(['before', 'change']);
    await act(async () => vi.runAllTimers());
    expect(order).toEqual(['before', 'change', 'terminal']);

    const blocked = createRef<CgDrawerActions>();
    const change = vi.fn();
    render(<CgDrawer {...content()} actionsRef={blocked} onBeforeOpen={() => false} onOpenChange={change} />);
    await expect(act(() => blocked.current!.open())).resolves.toBe(false);
    expect(change).not.toHaveBeenCalled();
  });

  it('aborts stale before work and suppresses stale terminal completions', async () => {
    const actions = createRef<CgDrawerActions>();
    let resolveOpen: ((accepted: boolean) => void) | undefined;
    let openSignal: AbortSignal | undefined;
    const opened = vi.fn();
    const closed = vi.fn();
    render(<CgDrawer
      {...content()}
      actionsRef={actions}
      onBeforeOpen={(details) => {
        openSignal = details.signal;
        return new Promise<boolean>((resolve) => { resolveOpen = resolve; });
      }}
      onOpened={opened}
      onClosed={closed}
    />);
    const pending = actions.current!.open();
    await act(() => actions.current?.close());
    expect(openSignal?.aborted).toBe(true);
    resolveOpen?.(true);
    await expect(pending).resolves.toBe(false);
    expect(actions.current?.getState()).toBe(false);
    expect(opened).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('keeps controlled intent authoritative and applies direct controlled updates while disabled', async () => {
    const actions = createRef<CgDrawerActions>();
    const change = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return <>
        <button onClick={() => setOpen(true)}>Owner open</button>
        <CgDrawer {...content()} open={open} disabled actionsRef={actions} onOpenChange={change} />
      </>;
    }
    render(<Controlled />);
    await expect(act(() => actions.current!.open())).resolves.toBe(false);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Owner open'));
    expect(actions.current?.getState()).toBe(true);
    expect(document.querySelector('[data-cg-drawer]')).toHaveAttribute('data-cg-open', 'true');
    expect(change).not.toHaveBeenCalled();
  });

  it('reports controlled refusal and gives direct disabled changes one terminal callback', async () => {
    const rejected = createRef<CgDrawerActions>();
    const rejectedChange = vi.fn();
    render(<CgDrawer {...content()} open={false} actionsRef={rejected} onOpenChange={rejectedChange} />);
    await expect(act(() => rejected.current!.open())).resolves.toBe(false);
    expect(rejectedChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'programmatic' }));
    expect(rejected.current?.getState()).toBe(false);

    vi.useFakeTimers();
    const opened = vi.fn();
    const before = vi.fn();
    const directChange = vi.fn();
    function DirectControlled() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Direct owner change</button><CgDrawer {...content()} open={open} disabled onBeforeOpen={before} onOpenChange={directChange} onOpened={opened} /></>;
    }
    render(<DirectControlled />);
    fireEvent.click(screen.getByText('Direct owner change'));
    await act(async () => vi.runAllTimers());
    expect(before).not.toHaveBeenCalled();
    expect(directChange).not.toHaveBeenCalled();
    expect(opened).toHaveBeenCalledOnce();
  });

  it('suppresses the stale terminal callback during a rapid reversal', async () => {
    vi.useFakeTimers();
    const actions = createRef<CgDrawerActions>();
    const opened = vi.fn();
    const closed = vi.fn();
    render(<CgDrawer {...content()} actionsRef={actions} onOpened={opened} onClosed={closed} />);
    await act(() => actions.current?.open());
    await act(() => actions.current?.close());
    await act(async () => vi.runAllTimers());
    expect(opened).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('switches responsive presentation without changing open intent or lifecycle callbacks', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const matchMedia = vi.fn((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, callback: EventListenerOrEventListenerObject) => {
        listener = callback as (event: MediaQueryListEvent) => void;
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    const change = vi.fn();
    const before = vi.fn();
    render(<CgDrawer {...content()} defaultOpen responsiveOverlay responsiveBreakpoint={768} onOpenChange={change} onBeforeClose={before} />);
    const root = document.querySelector('[data-cg-drawer]');
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767.98px)');
    expect(root).toHaveAttribute('data-cg-mode', 'shrink');
    act(() => listener?.({ matches: true } as MediaQueryListEvent));
    expect(root).toHaveAttribute('data-cg-mode', 'overlay');
    expect(root).toHaveAttribute('data-cg-open', 'true');
    expect(change).not.toHaveBeenCalled();
    expect(before).not.toHaveBeenCalled();
  });

  it('uses the shared overlay stack for outside pairs and Escape', async () => {
    const first = vi.fn();
    const second = vi.fn();
    render(<>
      <CgDrawer {...content()} mode="overlay" defaultOpen onOpenChange={first} />
      <CgDrawer {...content()} mode="overlay" defaultOpen onOpenChange={second} />
    </>);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(second).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' })));
    expect(first).not.toHaveBeenCalled();

    first.mockClear();
    fireEvent.pointerDown(document.body, { pointerId: 10 });
    fireEvent.pointerUp(document.body, { pointerId: 10 });
    await waitFor(() => expect(first).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'outsideInteraction' })));
  });

  it('supports focus actions, visibility cancellation, and Strict Mode cleanup', async () => {
    const actions = createRef<CgDrawerActions>();
    const { rerender, unmount } = render(<StrictMode><CgDrawer {...content()} defaultOpen mode="overlay" actionsRef={actions} /></StrictMode>);
    actions.current?.focusDrawer();
    expect(screen.getByLabelText('Drawer field')).toHaveFocus();
    await act(() => actions.current?.close());
    actions.current?.focus();
    expect(document.querySelector('[data-cg-drawer-content]')).toHaveFocus();
    rerender(<StrictMode><CgDrawer {...content()} defaultOpen mode="overlay" visible={false} actionsRef={actions} /></StrictMode>);
    expect(document.querySelector('[data-cg-drawer]')).toHaveAttribute('hidden');
    await expect(act(() => actions.current!.close())).resolves.toBe(false);
    unmount();
    expect(actions.current).toBeNull();
  });
});
