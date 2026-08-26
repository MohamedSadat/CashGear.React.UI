import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgContextMenu, useCgContextMenuTarget } from '../src';
import type { CgContextMenuActions, CgContextMenuItem } from '../src';

type RowContext = { id: number };

const basicItems: ReadonlyArray<CgContextMenuItem<RowContext>> = [
  { key: 'open', text: 'Open' },
  { key: 'more', text: 'More', children: [{ key: 'archive', text: 'Archive' }] },
];

describe('CgContextMenu', () => {
  it('shows at points, rectangles, and elements through actions', async () => {
    const actions = createRef<CgContextMenuActions<RowContext>>();
    const afterOpen = vi.fn();
    render(<CgContextMenu items={basicItems} actionsRef={actions} afterOpen={afterOpen} />);
    await act(() => actions.current!.showAt(20, 30, { id: 1 }));
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(afterOpen).toHaveBeenCalled();
    await act(() => actions.current!.hide());
    await act(() => actions.current!.showAtRectangle({ x: 2, y: 3, width: 10, height: 8 }, { id: 2 }));
    expect(screen.getByText('Open')).toBeInTheDocument();
    await act(() => actions.current!.hide());
    const anchor = document.createElement('button');
    document.body.append(anchor);
    await act(() => actions.current!.showNear(anchor, { id: 3 }));
    expect(screen.getByText('Open')).toBeInTheDocument();
    anchor.remove();
  });

  it('supersedes stale customization and aborts its signal', async () => {
    const actions = createRef<CgContextMenuActions<RowContext>>();
    const signals: AbortSignal[] = [];
    let release!: () => void;
    const first = new Promise<void>((resolve) => { release = resolve; });
    render(<CgContextMenu items={basicItems} actionsRef={actions} customizeMenu={async ({ invocation, signal }) => {
      signals.push(signal);
      if (invocation.context.id === 1) await first;
    }} />);
    let stale!: Promise<boolean>;
    act(() => { stale = actions.current!.showAt(1, 1, { id: 1 }); });
    await waitFor(() => expect(signals).toHaveLength(1));
    await act(() => actions.current!.showAt(2, 2, { id: 2 }));
    expect(signals[0]?.aborted).toBe(true);
    release();
    await expect(stale).resolves.toBe(false);
  });

  it('executes in order, prevents duplicates, and rolls back check state on failure', async () => {
    const actions = createRef<CgContextMenuActions<RowContext>>();
    const order: string[] = [];
    const failure = vi.fn();
    const items: ReadonlyArray<CgContextMenuItem<RowContext>> = [{
      key: 'toggle', text: 'Toggle', checked: false, confirmation: { message: 'Continue?' }, command: async () => { order.push('command'); throw new Error('failed'); },
    }];
    render(<CgContextMenu
      items={items}
      actionsRef={actions}
      validateContext={() => { order.push('validate'); return true; }}
      confirm={() => { order.push('confirm'); return true; }}
      beforeCommand={() => { order.push('before'); }}
      onItemActivate={() => { order.push('global'); }}
      commandFailure={(details) => { order.push('failure'); failure(details.error); }}
    />);
    await act(() => actions.current!.showAt(1, 1, { id: 1 }));
    const toggle = screen.getByText('Toggle').closest('button')!;
    await act(async () => { fireEvent.click(toggle); fireEvent.click(toggle); });
    expect(order).toEqual(['validate', 'confirm', 'before', 'global', 'command', 'failure']);
    expect(failure).toHaveBeenCalled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('rejects confirmation-bearing items without explicit integration', () => {
    expect(() => render(<CgContextMenu<RowContext> items={[{ key: 'delete', text: 'Delete', confirmation: { message: 'Delete?' } }]} />)).toThrow(/requires the confirm callback/);
  });

  it('runs target triggers and closes an owned invocation on disposal', async () => {
    const actions = createRef<CgContextMenuActions<RowContext>>();
    function Target() {
      const { targetProps } = useCgContextMenuTarget({ menuRef: actions, context: { id: 7 }, openOnLongPress: true });
      return <button {...targetProps}>Row seven</button>;
    }
    const rendered = render(<><Target /><CgContextMenu items={basicItems} actionsRef={actions} /></>);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Row seven' }), { clientX: 12, clientY: 14 });
    expect(await screen.findByText('Open')).toBeInTheDocument();
    await act(() => actions.current!.hide());
    fireEvent.keyDown(screen.getByRole('button', { name: 'Row seven' }), { key: 'F10', shiftKey: true });
    expect(await screen.findByText('Open')).toBeInTheDocument();
    rendered.unmount();
  });

  it('fully closes an open invocation before superseding it', async () => {
    const actions = createRef<CgContextMenuActions<RowContext>>();
    const afterClose = vi.fn();
    render(<CgContextMenu items={basicItems} actionsRef={actions} afterClose={afterClose} />);
    await act(() => actions.current!.showAt(1, 1, { id: 1 }));
    await act(() => actions.current!.showAt(2, 2, { id: 2 }));
    expect(afterClose).toHaveBeenCalledWith(expect.objectContaining({ reason: 'superseded', invocation: expect.objectContaining({ context: { id: 1 } }) }));
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('discards cancelled openings and composes consumer target handlers', async () => {
    const actions = createRef<CgContextMenuActions<RowContext>>();
    const consumerClick = vi.fn((event: MouseEvent<HTMLElement>) => event.preventDefault());
    function Target() {
      const { targetProps } = useCgContextMenuTarget({
        menuRef: actions,
        context: { id: 9 },
        openOnClick: true,
        existingProps: { onClick: consumerClick },
      });
      return <button {...targetProps}>Composed target</button>;
    }
    render(<><Target /><CgContextMenu items={basicItems} actionsRef={actions} beforeOpen={() => false} /></>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Composed target' })); });
    expect(consumerClick).toHaveBeenCalledOnce();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    await expect(actions.current!.showAt(1, 1, { id: 9 })).resolves.toBe(false);
  });

  it('cancels moved long presses and reports owner loss during target cleanup', () => {
    vi.useFakeTimers();
    try {
      const showAt = vi.fn();
      const hide = vi.fn();
      const menuRef = {
        current: { showAt, hide } as unknown as CgContextMenuActions<RowContext>,
      };
      function Target() {
        const { targetProps } = useCgContextMenuTarget({
          menuRef,
          context: { id: 11 },
          longPressDelay: 600,
          longPressMovementThreshold: 10,
        });
        return <button {...targetProps}>Long-press row</button>;
      }
      const rendered = render(<Target />);
      const target = screen.getByRole('button', { name: 'Long-press row' });
      fireEvent.pointerDown(target, { pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(target, { pointerType: 'touch', pointerId: 1, clientX: 30, clientY: 10 });
      act(() => vi.advanceTimersByTime(650));
      expect(showAt).not.toHaveBeenCalled();
      fireEvent.pointerDown(target, { pointerType: 'touch', pointerId: 2, clientX: 20, clientY: 20 });
      act(() => vi.advanceTimersByTime(600));
      expect(showAt).toHaveBeenCalledWith(20, 20, { id: 11 }, expect.objectContaining({ kind: 'longPress' }));
      rendered.unmount();
      expect(hide).toHaveBeenCalledWith('ownerLoss', expect.any(String));
    } finally {
      vi.useRealTimers();
    }
  });
});
