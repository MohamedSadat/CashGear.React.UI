import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgPopup, CgWindow } from '../src';
import type { CgWindowActions } from '../src';

function stackOrder(element: HTMLElement): number {
  return Number(element.closest<HTMLElement>('[data-cg-overlay-portal]')?.style.zIndex.match(/\+ (\d+)/)?.[1] ?? 0);
}

describe('CgWindow', () => {
  it('renders modeless shared chrome without isolating or locking the page', () => {
    render(<CgWindow defaultOpen headerText="Tools" footerText="Ready">Window body</CgWindow>);
    const window = screen.getByRole('dialog', { name: 'Tools' });
    expect(window).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(window.closest('[data-cg-overlay-portal]')).not.toHaveAttribute('inert');
  });

  it('implements show, showAt, move, point, and showNear actions with precise position reasons', async () => {
    const actions = createRef<CgWindowActions>();
    const positions = vi.fn();
    const openChanges = vi.fn();
    const anchor = document.createElement('button');
    anchor.id = 'near-window';
    anchor.getBoundingClientRect = () => ({ x: 40, y: 50, left: 40, top: 50, right: 140, bottom: 80, width: 100, height: 30, toJSON: () => ({}) });
    document.body.append(anchor);
    render(<CgWindow actionsRef={actions} onPositionChange={positions} onOpenChange={openChanges} headerText="Actions">Body</CgWindow>);

    await act(() => actions.current?.showAt(20, 30));
    expect(screen.getByRole('dialog').style.left).toBe('20px');
    expect(positions).toHaveBeenLastCalledWith({ x: 20, y: 30 }, expect.objectContaining({ reason: 'showAt' }));
    act(() => actions.current?.moveToPoint({ x: 60, y: 70 }));
    expect(positions).toHaveBeenLastCalledWith({ x: 60, y: 70 }, expect.objectContaining({ reason: 'move' }));
    act(() => actions.current?.moveTo(65, 75));
    expect(positions).toHaveBeenLastCalledWith({ x: 65, y: 75 }, expect.objectContaining({ reason: 'move' }));
    await act(() => actions.current?.showAtPoint({ x: 70, y: 80 }));
    expect(positions).toHaveBeenLastCalledWith({ x: 70, y: 80 }, expect.objectContaining({ reason: 'showAt' }));
    await act(() => actions.current?.showNear('#near-window'));
    expect(positions).toHaveBeenLastCalledWith({ x: 40, y: 84 }, expect.objectContaining({ reason: 'showNear' }));
    act(() => actions.current?.focus());
    expect(screen.getByRole('dialog')).toHaveFocus();
    await act(() => actions.current?.close());
    expect(openChanges).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'programmatic' }));
    anchor.remove();
  });

  it('raises a window on pointer or focus entry and scopes Escape to the owning window', async () => {
    const firstChange = vi.fn();
    const secondChange = vi.fn();
    render(
      <>
        <button>Outside windows</button>
        <CgWindow defaultOpen headerText="First" onOpenChange={firstChange}><button>First action</button></CgWindow>
        <CgWindow defaultOpen headerText="Second" onOpenChange={secondChange}><button>Second action</button></CgWindow>
      </>,
    );
    const first = screen.getByRole('dialog', { name: 'First' });
    const second = screen.getByRole('dialog', { name: 'Second' });
    expect(stackOrder(second)).toBeGreaterThan(stackOrder(first));

    screen.getByText('Outside windows').focus();
    fireEvent.keyDown(screen.getByText('Outside windows'), { key: 'Escape' });
    expect(firstChange).not.toHaveBeenCalled();
    expect(secondChange).not.toHaveBeenCalled();

    screen.getByText('First action').focus();
    await waitFor(() => expect(stackOrder(first)).toBeGreaterThan(stackOrder(second)));
    fireEvent.keyDown(screen.getByText('First action'), { key: 'Escape' });
    await waitFor(() => expect(firstChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' })));
    expect(secondChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Second' })).toBeInTheDocument();
  });

  it('does not let a modeless window paint or focus above an active modal', async () => {
    render(
      <>
        <CgWindow defaultOpen headerText="Modeless"><button>Window action</button></CgWindow>
        <CgPopup defaultOpen headerText="Modal"><button>Modal action</button></CgPopup>
      </>,
    );
    await waitFor(() => expect(screen.getByText('Modal action')).toHaveFocus());
    screen.getByText('Window action').focus();
    await waitFor(() => expect(screen.getByText('Modal action')).toHaveFocus());
    expect(screen.getByText('Window action').closest<HTMLElement>('[data-cg-overlay-portal]')?.style.zIndex).toContain('--cg-z-overlay');
    expect(screen.getByText('Modal action').closest<HTMLElement>('[data-cg-overlay-portal]')?.style.zIndex).toContain('--cg-z-modal');
  });

  it('restores focus only when the closing window owned focus', async () => {
    const first = createRef<CgWindowActions>();
    const second = createRef<CgWindowActions>();
    render(
      <>
        <button>Origin</button>
        <CgWindow actionsRef={first} headerText="First"><button>Inside first</button></CgWindow>
        <CgWindow actionsRef={second} headerText="Second"><button>Inside second</button></CgWindow>
      </>,
    );
    screen.getByText('Origin').focus();
    await act(() => first.current?.show());
    await waitFor(() => expect(screen.getByText('Inside first')).toHaveFocus());
    await act(() => first.current?.close());
    await waitFor(() => expect(screen.getByText('Origin')).toHaveFocus());
    await act(() => first.current?.show());
    await waitFor(() => expect(screen.getByText('Inside first')).toHaveFocus());
    await act(() => second.current?.show());
    await waitFor(() => expect(screen.getByText('Inside second')).toHaveFocus());
    await act(() => first.current?.close());
    expect(screen.getByText('Inside second')).toHaveFocus();
    await act(() => second.current?.close());
    await waitFor(() => expect(screen.queryByText('Inside first')).not.toBeInTheDocument());
  });

  it('reports dragging and snaps rejected controlled movement to authoritative coordinates', () => {
    const positionChange = vi.fn();
    render(<CgWindow defaultOpen headerText="Move" position={{ x: 90, y: 70 }} onPositionChange={positionChange}>Body</CgWindow>);
    const window = screen.getByRole('dialog');
    vi.spyOn(window, 'getBoundingClientRect').mockImplementation(() => ({
      x: Number.parseFloat(window.style.left) || 90,
      y: Number.parseFloat(window.style.top) || 70,
      left: Number.parseFloat(window.style.left) || 90,
      top: Number.parseFloat(window.style.top) || 70,
      width: 300,
      height: 180,
      right: (Number.parseFloat(window.style.left) || 90) + 300,
      bottom: (Number.parseFloat(window.style.top) || 70) + 180,
      toJSON: () => ({}),
    }));
    const header = screen.getByText('Move').closest<HTMLElement>('[data-cg-overlay-header]')!;
    fireEvent.pointerDown(header, { pointerId: 8, button: 0, clientX: 90, clientY: 70 });
    fireEvent.pointerMove(window, { pointerId: 8, clientX: 120, clientY: 100 });
    fireEvent.pointerUp(window, { pointerId: 8, clientX: 120, clientY: 100 });
    expect(positionChange).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ reason: 'drag' }));
    expect(window.style.left).toBe('90px');
    expect(window.style.top).toBe('70px');
  });

  it('enforces computed resize limits and releases pointer capture', () => {
    render(<CgWindow defaultOpen headerText="Resize constraints" defaultPosition={{ x: 80, y: 60 }} width={240} height={140} minWidth={200} maxWidth={260} minHeight={100} maxHeight={180} allowResize>Body</CgWindow>);
    const window = screen.getByRole('dialog');
    const releasePointerCapture = vi.fn();
    window.setPointerCapture = vi.fn();
    window.hasPointerCapture = vi.fn(() => true);
    window.releasePointerCapture = releasePointerCapture;
    vi.spyOn(window, 'getBoundingClientRect').mockImplementation(() => ({
      x: Number.parseFloat(window.style.left) || 80,
      y: Number.parseFloat(window.style.top) || 60,
      left: Number.parseFloat(window.style.left) || 80,
      top: Number.parseFloat(window.style.top) || 60,
      width: Number.parseFloat(window.style.width) || 240,
      height: Number.parseFloat(window.style.height) || 140,
      right: (Number.parseFloat(window.style.left) || 80) + (Number.parseFloat(window.style.width) || 240),
      bottom: (Number.parseFloat(window.style.top) || 60) + (Number.parseFloat(window.style.height) || 140),
      toJSON: () => ({}),
    }));
    const handle = window.querySelector<HTMLElement>('[data-cg-resize="se"]')!;
    fireEvent.pointerDown(handle, { pointerId: 13, button: 0, clientX: 320, clientY: 200 });
    fireEvent.pointerMove(window, { pointerId: 13, clientX: 720, clientY: 600 });
    fireEvent.pointerUp(window, { pointerId: 13, clientX: 720, clientY: 600 });
    expect(window.style.width).toBe('260px');
    expect(window.style.height).toBe('180px');
    expect(releasePointerCapture).toHaveBeenCalledWith(13);
  });

  it('rejects invalid geometry and missing showNear targets with actionable errors and supports SSR', async () => {
    expect(() => render(<CgWindow position={{ x: Number.POSITIVE_INFINITY, y: 0 }} />)).toThrow(/coordinates must be finite/);
    const actions = createRef<CgWindowActions>();
    render(<CgWindow actionsRef={actions} />);
    await expect(actions.current?.showNear('[')).rejects.toThrow(/selector is invalid/);
    await expect(actions.current?.showNear('#absent')).rejects.toThrow(/could not find/);
    expect(renderToString(<CgWindow open headerText="Server">Body</CgWindow>)).toContain('data-cg-overlay-origin');
  });
});
