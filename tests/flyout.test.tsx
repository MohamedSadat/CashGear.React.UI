import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgFlyout } from '../src';
import type { CgFlyoutActions } from '../src';

describe('CgFlyout', () => {
  it('supports element, ref, selector, rectangle, and point anchors', async () => {
    const anchorRect = { x: 100, y: 80, left: 100, top: 80, right: 220, bottom: 110, width: 120, height: 30, toJSON: () => ({}) };
    const element = document.createElement('button');
    element.id = 'selector-flyout-anchor';
    element.getBoundingClientRect = () => anchorRect;
    document.body.append(element);
    function RefAnchor() {
      const anchor = createRef<HTMLButtonElement>();
      return <><button ref={(node) => { anchor.current = node; if (node) node.getBoundingClientRect = () => anchorRect; }}>Ref anchor</button><CgFlyout anchor={anchor} defaultOpen>Ref body</CgFlyout></>;
    }
    render(
      <>
        <CgFlyout anchor={element} defaultOpen>Element body</CgFlyout>
        <CgFlyout anchor="#selector-flyout-anchor" defaultOpen>Selector body</CgFlyout>
        <CgFlyout anchor={{ x: 30, y: 40, width: 25, height: 10 }} defaultOpen>Rectangle body</CgFlyout>
        <CgFlyout anchor={{ x: 50, y: 60 }} defaultOpen>Point body</CgFlyout>
        <RefAnchor />
      </>,
    );
    await waitFor(() => {
      for (const text of ['Element body', 'Selector body', 'Rectangle body', 'Point body', 'Ref body']) {
        expect(screen.getByText(text).closest('[data-cg-overlay-surface="flyout"]')).not.toHaveAttribute('hidden');
      }
    });
    element.remove();
  });

  it('applies offset, flip, shift, and anchor-width matching and exposes focus actions', async () => {
    const actions = createRef<CgFlyoutActions>();
    const anchor = document.createElement('button');
    anchor.textContent = 'Geometry anchor';
    const top = window.innerHeight - 40;
    anchor.getBoundingClientRect = () => ({ x: window.innerWidth - 30, y: top, left: window.innerWidth - 30, top, right: window.innerWidth + 90, bottom: top + 20, width: 120, height: 20, toJSON: () => ({}) });
    document.body.append(anchor);
    render(<CgFlyout anchor={anchor} defaultOpen actionsRef={actions} placement="bottom-start" offset={8} matchAnchorWidth><button>First focus</button></CgFlyout>);
    const surface = screen.getByText('First focus').closest<HTMLElement>('[data-cg-overlay-surface="flyout"]')!;
    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) }));
    act(() => actions.current?.reposition());
    await waitFor(() => expect(surface).toHaveAttribute('data-cg-flyout-placed', 'top'));
    expect(surface.style.width).toBe('120px');
    expect(Number.parseFloat(surface.style.top)).toBe(top - 108);
    expect(Number.parseFloat(surface.style.left)).toBeLessThanOrEqual(window.innerWidth - 124);
    act(() => actions.current?.focusFirst());
    expect(screen.getByText('First focus')).toHaveFocus();
    act(() => actions.current?.focusAnchor());
    expect(anchor).toHaveFocus();
    anchor.remove();
  });

  it('renders body-portalled chrome at a virtual anchor and retains first-open content', async () => {
    const actions = createRef<CgFlyoutActions>();
    render(
      <CgFlyout
        anchor={{ x: 24, y: 36 }}
        contentLoadMode="firstOpen"
        header="Header"
        footer="Footer"
        actionsRef={actions}
      >Body</CgFlyout>,
    );
    expect(screen.queryByText('Body')).not.toBeInTheDocument();

    await act(() => actions.current?.open());
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Body').closest('[data-cg-overlay-portal]')).toHaveAttribute('data-cg-overlay-surface', 'flyout');

    await act(() => actions.current?.close());
    expect(screen.getByText('Body').closest('[data-cg-overlay-portal]')).toHaveAttribute('hidden');
  });

  it('runs cancellable lifecycle proposals without optimistic controlled transitions', async () => {
    const actions = createRef<CgFlyoutActions>();
    const beforeOpen = vi.fn(() => false);
    const change = vi.fn();
    render(<CgFlyout anchor={{ x: 0, y: 0 }} actionsRef={actions} onBeforeOpen={beforeOpen} onOpenChange={change}>Body</CgFlyout>);

    await act(() => actions.current?.open());
    expect(beforeOpen).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByText('Body')).not.toBeInTheDocument();

    function Controlled() {
      const [open] = useState(false);
      return <CgFlyout anchor={{ x: 0, y: 0 }} open={open} actionsRef={actions} onOpenChange={change}>Controlled</CgFlyout>;
    }
    render(<Controlled />);
    await act(() => actions.current?.open());
    expect(change).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'programmatic' }));
    expect(screen.queryByText('Controlled')).not.toBeInTheDocument();
  });

  it('dismisses only on a matched outside pointer pair and respects boundary markers', async () => {
    const change = vi.fn();
    render(<CgFlyout anchor={{ x: 10, y: 10 }} defaultOpen onOpenChange={change}><button>Inside</button></CgFlyout>);
    const surface = screen.getByText('Inside').closest<HTMLElement>('[data-cg-overlay-id]');
    expect(surface).not.toBeNull();

    fireEvent.pointerDown(screen.getByText('Inside'), { pointerId: 1 });
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    expect(change).not.toHaveBeenCalled();

    const boundary = document.createElement('div');
    boundary.dataset.cgOverlayBoundary = surface?.dataset.cgOverlayId ?? '';
    document.body.append(boundary);
    fireEvent.pointerDown(boundary, { pointerId: 2 });
    fireEvent.pointerUp(boundary, { pointerId: 2 });
    expect(change).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body, { pointerId: 3 });
    fireEvent.pointerUp(document.body, { pointerId: 3 });
    await waitFor(() => expect(change).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'outsideClick' })));
    boundary.remove();
  });

  it('closes only the topmost Flyout on Escape', async () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <CgFlyout anchor={{ x: 1, y: 1 }} defaultOpen onOpenChange={first}>First</CgFlyout>
        <CgFlyout anchor={{ x: 2, y: 2 }} defaultOpen onOpenChange={second}>Second</CgFlyout>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(second).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' })));
    expect(first).not.toHaveBeenCalled();
  });

  it('uses the shared captured-pointer resize handles', () => {
    render(<CgFlyout anchor={{ x: 40, y: 40 }} defaultOpen resizable>Resizable body</CgFlyout>);
    const surface = screen.getByText('Resizable body').closest<HTMLElement>('[data-cg-overlay-surface="flyout"]')!;
    const releasePointerCapture = vi.fn();
    surface.setPointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
    surface.releasePointerCapture = releasePointerCapture;
    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() => ({
      x: Number.parseFloat(surface.style.left) || 40,
      y: Number.parseFloat(surface.style.top) || 40,
      left: Number.parseFloat(surface.style.left) || 40,
      top: Number.parseFloat(surface.style.top) || 40,
      width: Number.parseFloat(surface.style.width) || 240,
      height: Number.parseFloat(surface.style.height) || 120,
      right: (Number.parseFloat(surface.style.left) || 40) + (Number.parseFloat(surface.style.width) || 240),
      bottom: (Number.parseFloat(surface.style.top) || 40) + (Number.parseFloat(surface.style.height) || 120),
      toJSON: () => ({}),
    }));
    expect(surface.querySelectorAll('[data-cg-resize]')).toHaveLength(8);
    const handle = surface.querySelector<HTMLElement>('[data-cg-resize="se"]')!;
    fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientX: 280, clientY: 160 });
    fireEvent.pointerMove(surface, { pointerId: 7, clientX: 320, clientY: 190 });
    fireEvent.pointerUp(surface, { pointerId: 7, clientX: 320, clientY: 190 });
    expect(surface.style.width).toBe('280px');
    expect(surface.style.height).toBe('150px');
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('keeps an exclusive newcomer closed when the incumbent refuses supersession', async () => {
    const newcomer = createRef<CgFlyoutActions>();
    const incumbentChange = vi.fn();
    render(
      <>
        <CgFlyout anchor={{ x: 1, y: 1 }} defaultOpen exclusiveGroup="tools" onBeforeClose={() => false} onOpenChange={incumbentChange}>Incumbent</CgFlyout>
        <CgFlyout anchor={{ x: 2, y: 2 }} exclusiveGroup="tools" actionsRef={newcomer}>Newcomer</CgFlyout>
      </>,
    );
    await act(() => newcomer.current?.open());
    expect(incumbentChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Newcomer')).not.toBeInTheDocument();
  });

  it('closes accepted exclusive incumbents as superseded and reports scroll and programmatic reasons', async () => {
    const newcomer = createRef<CgFlyoutActions>();
    const incumbentChange = vi.fn();
    const newcomerChange = vi.fn();
    render(
      <>
        <CgFlyout anchor={{ x: 1, y: 1 }} defaultOpen exclusiveGroup="accepted" onOpenChange={incumbentChange}>Accepted incumbent</CgFlyout>
        <CgFlyout anchor={{ x: 2, y: 2 }} exclusiveGroup="accepted" actionsRef={newcomer} onOpenChange={newcomerChange}>Accepted newcomer</CgFlyout>
      </>,
    );
    await act(() => newcomer.current?.open());
    expect(incumbentChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'superseded' }));
    expect(newcomerChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'programmatic' }));
    await act(() => newcomer.current?.close());
    expect(newcomerChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'programmatic' }));

    const scrollChange = vi.fn();
    const scrollAnchor = document.createElement('button');
    scrollAnchor.getBoundingClientRect = () => ({ x: 10, y: 10, left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20, toJSON: () => ({}) });
    const scroller = document.createElement('div');
    scroller.append(scrollAnchor);
    document.body.append(scroller);
    render(<CgFlyout anchor={scrollAnchor} defaultOpen closeOnScroll onOpenChange={scrollChange}>Scroll body</CgFlyout>);
    fireEvent.scroll(scroller);
    await waitFor(() => expect(scrollChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'scroll' })));
    scroller.remove();
  });

  it('aborts stale lifecycle work and reports rejections as cancellation', async () => {
    const actions = createRef<CgFlyoutActions>();
    let resolveOpen: ((value: boolean) => void) | undefined;
    const error = new Error('refused');
    const lifecycleError = vi.fn();
    render(
      <CgFlyout
        anchor={{ x: 0, y: 0 }}
        actionsRef={actions}
        onBeforeOpen={() => new Promise<boolean>((resolve) => { resolveOpen = resolve; })}
        onBeforeClose={() => Promise.reject(error)}
        onLifecycleError={lifecycleError}
      >Body</CgFlyout>,
    );
    const pending = actions.current?.open();
    await act(() => actions.current?.close());
    resolveOpen?.(true);
    await act(async () => { await pending; });
    expect(screen.queryByText('Body')).not.toBeInTheDocument();

    // Open with a fresh instance so the rejected close hook is exercised.
    const closeActions = createRef<CgFlyoutActions>();
    render(<CgFlyout anchor={{ x: 0, y: 0 }} defaultOpen actionsRef={closeActions} onBeforeClose={() => Promise.reject(error)} onLifecycleError={lifecycleError}>Open body</CgFlyout>);
    await act(() => closeActions.current?.close());
    expect(screen.getByText('Open body')).toBeInTheDocument();
    expect(lifecycleError).toHaveBeenCalledWith(error, 'beforeClose');
  });

  it('prevents a stale asynchronous close from hiding a newly reopened Flyout', async () => {
    const actions = createRef<CgFlyoutActions>();
    let closeSignal: AbortSignal | undefined;
    let resolveClose: ((accepted: boolean) => void) | undefined;
    render(
      <CgFlyout
        anchor={{ x: 0, y: 0 }}
        defaultOpen
        actionsRef={actions}
        onBeforeClose={(details) => {
          closeSignal = details.signal;
          return new Promise<boolean>((resolve) => { resolveClose = resolve; });
        }}
      >Reopened body</CgFlyout>,
    );
    let pendingClose: Promise<void> | undefined;
    act(() => { pendingClose = actions.current?.close(); });
    await act(() => actions.current?.open());
    expect(closeSignal?.aborted).toBe(true);
    resolveClose?.(true);
    await act(async () => { await pendingClose; });
    expect(screen.getByText('Reopened body')).toBeInTheDocument();
  });

  it('aborts pending lifecycle work on unmount and closes a disappeared selector anchor', async () => {
    const actions = createRef<CgFlyoutActions>();
    const change = vi.fn();
    let signal: AbortSignal | undefined;
    let resolveOpen: ((accepted: boolean) => void) | undefined;
    const pendingView = render(
      <CgFlyout
        anchor={{ x: 1, y: 1 }}
        actionsRef={actions}
        onOpenChange={change}
        onBeforeOpen={(details) => {
          signal = details.signal;
          return new Promise<boolean>((resolve) => { resolveOpen = resolve; });
        }}
      >Pending</CgFlyout>,
    );
    let pending: Promise<void> | undefined;
    act(() => { pending = actions.current?.open(); });
    expect(signal?.aborted).toBe(false);
    pendingView.unmount();
    expect(signal?.aborted).toBe(true);
    resolveOpen?.(true);
    await act(async () => { await pending; });
    expect(change).not.toHaveBeenCalled();

    const anchor = document.createElement('button');
    anchor.id = 'temporary-flyout-anchor';
    document.body.append(anchor);
    render(<CgFlyout anchor="#temporary-flyout-anchor" defaultOpen onOpenChange={change}>Anchored</CgFlyout>);
    anchor.remove();
    await waitFor(() => expect(change).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'anchorLost' })));
  });

  it('throws actionable selector and geometry errors and renders deterministically on the server', () => {
    expect(() => render(<CgFlyout anchor="[">Bad</CgFlyout>)).toThrow(/anchor selector is invalid/);
    expect(() => render(<CgFlyout anchor={{ x: Number.NaN, y: 0 }}>Bad</CgFlyout>)).toThrow(/coordinates must be finite/);
    expect(renderToString(<CgFlyout anchor={{ x: 1, y: 2 }} open>Server body</CgFlyout>)).toContain('data-cg-overlay-origin');
  });
});
