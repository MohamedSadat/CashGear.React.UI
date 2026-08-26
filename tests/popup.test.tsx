import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgFlyout, CgPopup } from '../src';
import type { CgPopupActions } from '../src';

describe('CgPopup', () => {
  it('is always modal, derives its accessible name only from standard header content, and honors content precedence', () => {
    render(
      <CgPopup
        defaultOpen
        header={<span>Node header</span>}
        headerText="Text header"
        body={<span>Node body</span>}
        bodyText="Text body"
        footer={<span>Node footer</span>}
        footerText="Text footer"
      >Child body</CgPopup>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Node header' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Node body')).toBeInTheDocument();
    expect(screen.queryByText('Child body')).not.toBeInTheDocument();
    expect(screen.getByText('Node footer')).toBeInTheDocument();
    expect(screen.queryByText('Text header')).not.toBeInTheDocument();
  });

  it('lets region renderers replace standard chrome and exposes close, focus, and boundary context', async () => {
    const close = vi.fn();
    render(
      <CgPopup
        defaultOpen
        onOpenChange={(_, details) => { close(details.reason); }}
        renderHeader={(context) => <button data-cg-overlay-boundary={context.boundaryId} onClick={() => void context.close()}>Custom header</button>}
        renderBody={(context) => <button onClick={context.focus}>Custom body</button>}
        renderFooter={() => <span>Custom footer</span>}
      />,
    );
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Custom header'));
    await waitFor(() => expect(close).toHaveBeenCalledWith('programmatic'));
  });

  it('traps initial focus, isolates the page, locks scrolling, and restores the opener after accepted close', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <div data-testid="application">
          <button onClick={() => setOpen(true)}>Launch</button>
          <CgPopup open={open} onOpenChange={setOpen} headerText="Modal">
            <button data-cg-autofocus>Preferred</button>
            <button>Last</button>
          </CgPopup>
        </div>
      );
    }
    render(<Example />);
    const opener = screen.getByText('Launch');
    opener.focus();
    opener.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.pointerDown(opener);
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByText('Preferred')).toHaveFocus());
    expect(screen.getByTestId('application').parentElement).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');

    screen.getByText('Last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Close')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
    expect(document.body.style.overflow).toBe('');
  });

  it('reference-counts nested modal scroll locks and restores exact styles on open disposal', async () => {
    const priorBodyOverflow = document.body.style.overflow;
    const priorBodyPadding = document.body.style.paddingRight;
    const priorRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'clip';
    document.body.style.paddingRight = '7px';
    document.documentElement.style.overflow = 'scroll';
    const parent = createRef<CgPopupActions>();
    const child = createRef<CgPopupActions>();
    const view = render(
      <CgPopup defaultOpen actionsRef={parent} headerText="Parent modal">
        <CgPopup defaultOpen actionsRef={child} headerText="Child modal">Nested</CgPopup>
      </CgPopup>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    await act(() => child.current?.close());
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.paddingRight).toBe('7px');
    expect(document.documentElement.style.overflow).toBe('scroll');
    document.body.style.overflow = priorBodyOverflow;
    document.body.style.paddingRight = priorBodyPadding;
    document.documentElement.style.overflow = priorRootOverflow;
  });

  it('treats nested portalled Flyouts and explicit boundary markers as inside the modal', async () => {
    const popupChange = vi.fn();
    render(
      <CgPopup defaultOpen closeOnOutsideClick onOpenChange={popupChange} headerText="Owner">
        <CgFlyout anchor={{ x: 4, y: 4 }} defaultOpen><button>Nested action</button></CgFlyout>
      </CgPopup>,
    );
    const nested = screen.getByText('Nested action');
    nested.focus();
    expect(nested).toHaveFocus();
    fireEvent.pointerDown(nested, { pointerId: 1 });
    fireEvent.pointerUp(nested, { pointerId: 1 });
    expect(popupChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Nested action')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps an owned third-party boundary portal interactive and inside the focus trap', async () => {
    render(<CgPopup defaultOpen headerText="Boundary owner">Body</CgPopup>);
    const portal = screen.getByRole('dialog').closest<HTMLElement>('[data-cg-overlay-id]')!;
    const thirdPartyPortal = document.createElement('div');
    thirdPartyPortal.dataset.cgOverlayBoundary = portal.dataset.cgOverlayId ?? '';
    const action = document.createElement('button');
    action.textContent = 'Third-party action';
    thirdPartyPortal.append(action);
    document.body.append(thirdPartyPortal);
    await waitFor(() => expect(thirdPartyPortal).not.toHaveAttribute('inert'));
    action.focus();
    expect(action).toHaveFocus();
    thirdPartyPortal.remove();
  });

  it('uses matched outside pointer pairs and reports close-button reasons', async () => {
    const change = vi.fn();
    const { unmount } = render(<CgPopup defaultOpen closeOnOutsideClick onOpenChange={change} headerText="Dismiss">Body</CgPopup>);
    const body = screen.getByText('Body');
    const backdrop = document.querySelector<HTMLElement>('[class*="backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(body, { pointerId: 2 });
    fireEvent.pointerUp(backdrop!, { pointerId: 2 });
    expect(change).not.toHaveBeenCalled();
    fireEvent.pointerDown(backdrop!, { pointerId: 3 });
    fireEvent.pointerUp(backdrop!, { pointerId: 3 });
    await waitFor(() => expect(change).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'outsideClick' })));

    unmount();
    render(<CgPopup defaultOpen onOpenChange={change} headerText="Button close">Body</CgPopup>);
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(change).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'closeButton' })));
  });

  it('supports cancellable controlled proposals and retained content modes', async () => {
    const actions = createRef<CgPopupActions>();
    const change = vi.fn();
    const { rerender } = render(
      <CgPopup actionsRef={actions} onBeforeOpen={() => false} onOpenChange={change} contentLoadMode="fromMount">Retained</CgPopup>,
    );
    expect(screen.getByText('Retained').closest('[data-cg-overlay-portal]')).toHaveAttribute('hidden');
    await act(() => actions.current?.open());
    expect(change).not.toHaveBeenCalled();

    rerender(<CgPopup open actionsRef={actions} onBeforeClose={() => false} onOpenChange={change}>Controlled</CgPopup>);
    await act(() => actions.current?.close());
    expect(screen.getByText('Controlled')).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('implements every-open, first-open, and from-mount content retention', async () => {
    const every = createRef<CgPopupActions>();
    const first = createRef<CgPopupActions>();
    const fromMount = createRef<CgPopupActions>();
    render(
      <>
        <CgPopup actionsRef={every} contentLoadMode="everyOpen">Every content</CgPopup>
        <CgPopup actionsRef={first} contentLoadMode="firstOpen">First content</CgPopup>
        <CgPopup actionsRef={fromMount} contentLoadMode="fromMount">Mount content</CgPopup>
      </>,
    );
    expect(screen.queryByText('Every content')).not.toBeInTheDocument();
    expect(screen.queryByText('First content')).not.toBeInTheDocument();
    expect(screen.getByText('Mount content').closest('[data-cg-overlay-portal]')).toHaveAttribute('hidden');
    await act(() => first.current?.open());
    await act(() => first.current?.close());
    expect(screen.getByText('First content').closest('[data-cg-overlay-portal]')).toHaveAttribute('hidden');
    await act(() => every.current?.open());
    expect(screen.getByText('Every content')).toBeInTheDocument();
    await act(() => every.current?.close());
    expect(screen.queryByText('Every content')).not.toBeInTheDocument();
  });

  it('treats direct controlled transitions as authoritative and emits only rendered after-hooks', async () => {
    const beforeOpen = vi.fn();
    const beforeClose = vi.fn();
    const afterOpen = vi.fn();
    const afterClose = vi.fn();
    const { rerender } = render(
      <CgPopup open={false} onBeforeOpen={beforeOpen} onBeforeClose={beforeClose} onAfterOpen={afterOpen} onAfterClose={afterClose}>Body</CgPopup>,
    );
    rerender(<CgPopup open onBeforeOpen={beforeOpen} onBeforeClose={beforeClose} onAfterOpen={afterOpen} onAfterClose={afterClose}>Body</CgPopup>);
    await waitFor(() => expect(afterOpen).toHaveBeenCalledOnce());
    expect(beforeOpen).not.toHaveBeenCalled();
    rerender(<CgPopup open={false} onBeforeOpen={beforeOpen} onBeforeClose={beforeClose} onAfterOpen={afterOpen} onAfterClose={afterClose}>Body</CgPopup>);
    await waitFor(() => expect(afterClose).toHaveBeenCalledOnce());
    expect(beforeClose).not.toHaveBeenCalled();
  });

  it('reports drag and resize lifecycle details and snaps rejected controlled positions back', async () => {
    const positionChange = vi.fn();
    const dragStart = vi.fn();
    const dragEnd = vi.fn();
    const resizeStart = vi.fn();
    const resizeEnd = vi.fn();
    render(
      <CgPopup
        defaultOpen
        headerText="Move"
        position={{ x: 100, y: 80 }}
        allowDrag
        allowResize
        onPositionChange={positionChange}
        onDragStart={dragStart}
        onDragEnd={dragEnd}
        onResizeStart={resizeStart}
        onResizeEnd={resizeEnd}
      >Body</CgPopup>,
    );
    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => ({
      x: Number.parseFloat(dialog.style.left) || 100,
      y: Number.parseFloat(dialog.style.top) || 80,
      left: Number.parseFloat(dialog.style.left) || 100,
      top: Number.parseFloat(dialog.style.top) || 80,
      width: Number.parseFloat(dialog.style.width) || 320,
      height: Number.parseFloat(dialog.style.height) || 200,
      right: (Number.parseFloat(dialog.style.left) || 100) + (Number.parseFloat(dialog.style.width) || 320),
      bottom: (Number.parseFloat(dialog.style.top) || 80) + (Number.parseFloat(dialog.style.height) || 200),
      toJSON: () => ({}),
    }));
    const header = screen.getByText('Move').closest<HTMLElement>('[data-cg-overlay-header]')!;
    fireEvent.pointerDown(header, { pointerId: 4, button: 0, clientX: 100, clientY: 80 });
    fireEvent.pointerMove(dialog, { pointerId: 4, clientX: 130, clientY: 110 });
    fireEvent.pointerUp(dialog, { pointerId: 4, clientX: 130, clientY: 110 });
    expect(dragStart).toHaveBeenCalledOnce();
    expect(dragEnd).toHaveBeenCalledOnce();
    expect(positionChange).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ reason: 'drag' }));
    expect(dialog.style.left).toBe('100px');

    const handle = dialog.querySelector<HTMLElement>('[data-cg-resize="se"]')!;
    fireEvent.pointerDown(handle, { pointerId: 5, button: 0, clientX: 420, clientY: 280 });
    fireEvent.pointerMove(dialog, { pointerId: 5, clientX: 440, clientY: 300 });
    fireEvent.pointerUp(dialog, { pointerId: 5, clientX: 440, clientY: 300 });
    expect(resizeStart).toHaveBeenCalledOnce();
    expect(resizeEnd).toHaveBeenCalledOnce();
  });

  it('validates finite geometry and renders deterministically during SSR', () => {
    expect(() => render(<CgPopup position={{ x: Number.NaN, y: 0 }} />)).toThrow(/coordinates must be finite/);
    expect(renderToString(<CgPopup open headerText="Server">Body</CgPopup>)).toContain('data-cg-overlay-origin');
  });
});
