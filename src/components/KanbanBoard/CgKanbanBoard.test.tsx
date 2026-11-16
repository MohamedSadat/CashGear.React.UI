import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgKanbanBoard } from './CgKanbanBoard';
import type { CgKanbanBoardLabels, CgKanbanBoardProps, CgKanbanCard, CgKanbanColumn } from './CgKanbanBoard.types';
import {
  groupKanbanCards,
  kanbanCardsInWindow,
  kanbanColumnDropGap,
  kanbanColumnLayout,
  kanbanColumnLine,
  kanbanDropGap,
  kanbanGapOf,
  kanbanKeyMove,
  kanbanMoveColumn,
  kanbanMoveDrop,
  kanbanMoveFocus,
  kanbanNearestColumn,
  kanbanTargetIndex,
  moveKanbanCard,
  moveKanbanColumn,
} from './kanbanLayout';

const columns: CgKanbanColumn[] = [
  { key: 'todo', title: 'To do' },
  { key: 'doing', title: 'In progress' },
  { key: 'done', title: 'Done' },
];

function makeCards(counts: Record<string, number>): CgKanbanCard[] {
  return Object.entries(counts).flatMap(([columnKey, count]) => Array.from({ length: count }, (_, index) => ({
    key: `${columnKey}-${index}`,
    columnKey,
    label: `${columnKey} card ${index + 1}`,
  })));
}

const labels: CgKanbanBoardLabels = {
  board: 'Tasks board',
  column: (column, count) => `${column.title}, ${count} cards`,
  emptyColumn: 'No cards',
  cardHint: 'Space picks the card up, Enter opens it',
  cardHandle: (card) => `Move ${card.label}`,
  pickedUp: (card, column, index, count) => `Picked up ${card.label}, ${index + 1} of ${count} in ${column.title}`,
  position: (_card, column, index, count) => `${column.title}, ${index + 1} of ${count}`,
  moved: (card, column, index, count) => `${card.label} moved to ${column.title}, ${index + 1} of ${count}`,
  cancelled: (card) => `${card.label} stays`,
  moveToColumn: (column) => `Move to ${column.title}`,
  moveUp: 'Move up',
  moveDown: 'Move down',
  addCard: (column) => `New card in ${column.title}`,
  collapseColumn: (column) => `Collapse ${column.title}`,
  expandColumn: (column) => `Expand ${column.title}`,
  hiddenColumns: 'Hidden columns',
  showColumn: (column) => `Show ${column.title}`,
};

type BoardProps = Partial<CgKanbanBoardProps> & { initial?: CgKanbanCard[] };

/** A board that applies its moves, as a caller does. */
function Board({ initial = makeCards({ todo: 4, doing: 2, done: 1 }), onCardMove, ...props }: BoardProps) {
  const [cards, setCards] = useState(initial);
  return <CgKanbanBoard
    columns={columns}
    cards={cards}
    labels={labels}
    renderCard={(card) => <span>{card.label}</span>}
    onCardMove={(key, toColumnKey, toIndex, details) => {
      onCardMove?.(key, toColumnKey, toIndex, details);
      setCards((current) => moveKanbanCard(current, key, toColumnKey, toIndex));
    }}
    {...props}
  />;
}

const region = (name: RegExp | string) => screen.getByRole('region', { name });
const cardIn = (column: string, label: string) => within(region(new RegExp(`^${column},`, 'u'))).getByRole('listitem', { name: label });
const status = () => screen.getByRole('status');

function pointer(type: string, init: { x: number; y: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: init.x, clientY: init.y, pointerId: 1, button: 0 });
  return event;
}

function place(element: Element, left: number, top: number, width: number, height: number) {
  element.getBoundingClientRect = () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) });
}

afterEach(() => vi.restoreAllMocks());

describe('the board arithmetic', () => {
  it('lays a column out with its gaps and finds the cards in a window', () => {
    const layout = kanbanColumnLayout([40, 60, 40, 40], 8);
    expect(layout.offsets).toEqual([0, 48, 116, 164, 212]);
    expect(layout.total).toBe(212);
    expect(kanbanCardsInWindow(layout, 0, 48)).toEqual({ start: 0, end: 1 });
    expect(kanbanCardsInWindow(layout, 50, 120)).toEqual({ start: 1, end: 3 });
    expect(kanbanCardsInWindow(layout, -500, 10_000)).toEqual({ start: 0, end: 4 });
    expect(kanbanCardsInWindow(layout, 10_000, 20_000)).toEqual({ start: 0, end: 0 });
    expect(kanbanCardsInWindow(kanbanColumnLayout([], 8), 0, 500)).toEqual({ start: 0, end: 0 });
  });

  it('drops before the first card whose middle is below the pointer, counted with the dragged card', () => {
    const layout = kanbanColumnLayout([72, 72, 72], 8);
    expect(kanbanDropGap(layout, -10)).toBe(0);
    expect(kanbanDropGap(layout, 35)).toBe(0);
    expect(kanbanDropGap(layout, 36)).toBe(1);
    expect(kanbanDropGap(layout, 150)).toBe(2);
    expect(kanbanDropGap(layout, 5000)).toBe(3);
    expect(kanbanDropGap(kanbanColumnLayout([], 8), 20)).toBe(0);
  });

  it('turns a gap of its own column into the index after the move, and back', () => {
    expect(kanbanTargetIndex(1, 1)).toBeNull();
    expect(kanbanTargetIndex(1, 2)).toBeNull();
    expect(kanbanTargetIndex(1, 0)).toBe(0);
    expect(kanbanTargetIndex(1, 4)).toBe(3);
    expect(kanbanGapOf(1, 3)).toBe(4);
    expect(kanbanGapOf(2, 0)).toBe(0);
  });

  it('finds the nearest column by its box, in viewport pixels', () => {
    const boxes = [{ left: 0, right: 100 }, { left: 120, right: 220 }, { left: 240, right: 340 }];
    expect(kanbanNearestColumn(boxes, 50)).toBe(0);
    expect(kanbanNearestColumn(boxes, 108)).toBe(0);
    expect(kanbanNearestColumn(boxes, 115)).toBe(1);
    expect(kanbanNearestColumn(boxes, 900)).toBe(2);
    expect(kanbanNearestColumn([], 10)).toBe(-1);
  });

  it('mirrors left and right in RTL', () => {
    expect(kanbanKeyMove('ArrowRight', false)).toBe('next');
    expect(kanbanKeyMove('ArrowRight', true)).toBe('previous');
    expect(kanbanKeyMove('ArrowLeft', true)).toBe('next');
    expect(kanbanKeyMove('ArrowUp', true)).toBe('up');
    expect(kanbanKeyMove('End', false)).toBe('last');
    expect(kanbanKeyMove('a', false)).toBeNull();
  });

  it('moves the focus along a column and across to columns with cards', () => {
    const counts = [3, 0, 2];
    expect(kanbanMoveFocus(counts, { col: 0, index: 1 }, 'down')).toEqual({ col: 0, index: 2 });
    expect(kanbanMoveFocus(counts, { col: 0, index: 2 }, 'down')).toBeNull();
    expect(kanbanMoveFocus(counts, { col: 0, index: 2 }, 'next')).toEqual({ col: 2, index: 1 });
    expect(kanbanMoveFocus(counts, { col: 2, index: 0 }, 'previous')).toEqual({ col: 0, index: 0 });
    expect(kanbanMoveFocus(counts, { col: 2, index: 0 }, 'next')).toBeNull();
    expect(kanbanMoveFocus(counts, { col: 0, index: 0 }, 'last')).toEqual({ col: 0, index: 2 });
    expect(kanbanMoveFocus(counts, { col: 0, index: 0 }, 'first')).toBeNull();
  });

  it('moves a picked-up card to every place, empty columns included', () => {
    const others = [3, 0, 2];
    expect(kanbanMoveDrop(others, { col: 0, index: 3 }, 'down')).toBeNull();
    expect(kanbanMoveDrop(others, { col: 0, index: 2 }, 'down')).toEqual({ col: 0, index: 3 });
    expect(kanbanMoveDrop(others, { col: 0, index: 2 }, 'next')).toEqual({ col: 1, index: 0 });
    expect(kanbanMoveDrop(others, { col: 1, index: 0 }, 'next')).toEqual({ col: 2, index: 0 });
    expect(kanbanMoveDrop(others, { col: 2, index: 0 }, 'next')).toBeNull();
    expect(kanbanMoveDrop(others, { col: 0, index: 1 }, 'last')).toEqual({ col: 0, index: 3 });
  });

  it('groups cards by column, by order when given, and applies a move to a flat list', () => {
    const cards: CgKanbanCard[] = [
      { key: 'a', columnKey: 'todo', label: 'A', order: 2 },
      { key: 'b', columnKey: 'todo', label: 'B', order: 1 },
      { key: 'c', columnKey: 'doing', label: 'C' },
      { key: 'x', columnKey: 'gone', label: 'X' },
      { key: 'd', columnKey: 'todo', label: 'D', order: 1 },
    ];
    const grouped = groupKanbanCards(columns, cards);
    expect(grouped.get('todo')!.map((card) => card.key)).toEqual(['b', 'd', 'a']);
    expect(grouped.get('done')).toEqual([]);
    expect(grouped.has('gone')).toBe(false);
    expect(() => groupKanbanCards(columns, [...cards, { key: 'a', columnKey: 'done', label: 'A2' }])).toThrow(/unique/u);
    const flat = makeCards({ todo: 3, doing: 2 });
    expect(moveKanbanCard(flat, 'todo-0', 'doing', 1).map((card) => card.key)).toEqual(['todo-1', 'todo-2', 'doing-0', 'todo-0', 'doing-1']);
    expect(moveKanbanCard(flat, 'todo-0', 'todo', 2).map((card) => card.key)).toEqual(['todo-1', 'todo-2', 'todo-0', 'doing-0', 'doing-1']);
    expect(moveKanbanCard(flat, 'doing-1', 'done', 0).at(-1)).toMatchObject({ key: 'doing-1', columnKey: 'done' });
  });
});

describe('CgKanbanBoard', () => {
  it('draws a named region per column with its count, its cards and one tab stop', () => {
    render(<Board />);
    expect(screen.getByRole('region', { name: 'Tasks board' })).toBeInTheDocument();
    const todo = region('To do, 4 cards');
    const items = within(todo).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAccessibleName('todo card 1');
    expect(items[0]).toHaveAccessibleDescription('Space picks the card up, Enter opens it');
    expect(items[2]).toHaveAttribute('aria-posinset', '3');
    expect(items[2]).toHaveAttribute('aria-setsize', '4');
    expect(within(todo).getByText('4')).toHaveAttribute('aria-hidden', 'true');
    expect(within(todo).getByText('To do')).toHaveAttribute('dir', 'auto');
    expect(document.querySelectorAll('[data-cg-kanban-card][tabindex="0"]')).toHaveLength(1);
    expect(items[0]).toHaveAttribute('tabindex', '0');
    expect(within(items[0]!).getByRole('button', { name: 'Move todo card 1' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('says a column is empty, and draws no handles, pick-up or menu on a board shown only', () => {
    render(<CgKanbanBoard columns={columns} cards={makeCards({ todo: 2 })} labels={{ board: 'Board', column: (column) => column.title, emptyColumn: 'No cards' }} renderCard={(card) => card.label} />);
    expect(within(region('Done')).getByText('No cards')).toBeInTheDocument();
    expect(within(region('Done')).queryByRole('list')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const card = within(region('To do')).getAllByRole('listitem')[0]!;
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    expect(card).not.toHaveAttribute('data-cg-picked');
  });

  it('moves the focus with the arrows, Home and End, and opens a card with Enter or a click', async () => {
    const onCardOpen = vi.fn();
    render(<Board onCardOpen={onCardOpen} />);
    const first = cardIn('To do', 'todo card 1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cardIn('To do', 'todo card 2'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cardIn('In progress', 'doing card 2'));
    expect(document.activeElement).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(cardIn('To do', 'todo card 4'));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onCardOpen).toHaveBeenLastCalledWith('todo-3', { source: 'keyboard' });
    await userEvent.click(within(cardIn('Done', 'done card 1')).getByText('done card 1'));
    expect(onCardOpen).toHaveBeenLastCalledWith('done-0', { source: 'pointer' });
    // A click on the handle opens its menu, not the card.
    await userEvent.click(within(cardIn('Done', 'done card 1')).getByRole('button', { name: 'Move done card 1' }));
    // The menu is drawn hidden until it is placed, which jsdom never does: found with `hidden`.
    expect(await screen.findByRole('menu', { hidden: true })).toHaveAttribute('aria-label', 'Move done card 1');
    expect(onCardOpen).toHaveBeenCalledTimes(2);
  });

  it('moves a card to the next column by keys, says so, and the focus follows it', async () => {
    const onCardMove = vi.fn();
    render(<Board onCardMove={onCardMove} />);
    const card = cardIn('To do', 'todo card 2');
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    expect(card).toHaveAttribute('data-cg-picked');
    await waitFor(() => expect(status()).toHaveTextContent('Picked up todo card 2, 2 of 4 in To do'));
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    await waitFor(() => expect(status()).toHaveTextContent('In progress, 2 of 3'));
    const line = region(/^In progress,/u).querySelector<HTMLElement>('[data-cg-drop-indicator]')!;
    expect(line.hidden).toBe(false);
    expect(line.style.insetBlockStart).toBe('76px');
    fireEvent.keyDown(card, { key: ' ' });
    expect(onCardMove).toHaveBeenCalledTimes(1);
    expect(onCardMove).toHaveBeenCalledWith('todo-1', 'doing', 1, { fromColumnKey: 'todo', fromIndex: 1, source: 'keyboard' });
    expect(Object.isFrozen(onCardMove.mock.calls[0]![3])).toBe(true);
    await waitFor(() => expect(status()).toHaveTextContent('todo card 2 moved to In progress, 2 of 3'));
    const moved = cardIn('In progress', 'todo card 2');
    expect(document.activeElement).toBe(moved);
    expect(moved).not.toHaveAttribute('data-cg-picked');
    expect(moved).toHaveAttribute('aria-posinset', '2');
    expect(line.hidden).toBe(true);
    expect(within(region(/^To do,/u)).getAllByRole('listitem')).toHaveLength(3);
  });

  it('reorders within a column with the arrows and Enter, and Escape cancels', async () => {
    const onCardMove = vi.fn();
    render(<Board onCardMove={onCardMove} />);
    const card = cardIn('To do', 'todo card 1');
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    fireEvent.keyDown(card, { key: 'Escape' });
    expect(onCardMove).not.toHaveBeenCalled();
    expect(card).not.toHaveAttribute('data-cg-picked');
    await waitFor(() => expect(status()).toHaveTextContent('todo card 1 stays'));
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onCardMove).toHaveBeenCalledWith('todo-0', 'todo', 2, { fromColumnKey: 'todo', fromIndex: 0, source: 'keyboard' });
    const items = within(region(/^To do,/u)).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['todo card 2', 'todo card 3', 'todo card 1', 'todo card 4']);
    expect(document.activeElement).toBe(items[2]);
    // Dropped where it was: no move.
    fireEvent.keyDown(items[2]!, { key: ' ' });
    fireEvent.keyDown(items[2]!, { key: ' ' });
    expect(onCardMove).toHaveBeenCalledTimes(1);
  });

  it('mirrors the arrows in RTL: left is the next column', () => {
    const onCardMove = vi.fn();
    render(<div dir="rtl"><Board onCardMove={onCardMove} /></div>);
    const card = cardIn('To do', 'todo card 1');
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowLeft' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onCardMove).toHaveBeenCalledWith('todo-0', 'doing', 0, expect.objectContaining({ source: 'keyboard' }));
  });

  it('skips places canMove refuses, and keeps a fixed order: whole columns, dropped at the end', () => {
    const onCardMove = vi.fn();
    const { unmount } = render(<Board onCardMove={onCardMove} canMove={(_key, columnKey) => columnKey !== 'doing'} />);
    let card = cardIn('To do', 'todo card 1');
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onCardMove).toHaveBeenLastCalledWith('todo-0', 'done', 0, expect.anything());
    unmount();
    render(<Board onCardMove={onCardMove} fixedOrder />);
    card = cardIn('To do', 'todo card 2');
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowDown' });
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    expect(region(/^In progress,/u)).toHaveAttribute('data-cg-drop-target');
    fireEvent.keyDown(card, { key: ' ' });
    expect(onCardMove).toHaveBeenLastCalledWith('todo-1', 'doing', 2, expect.anything());
    expect(region(/^In progress,/u)).not.toHaveAttribute('data-cg-drop-target');
  });

  it('drags a card by pointer: the line moves without drawing a card, and one call on the drop', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onCardMove = vi.fn();
    const onCardOpen = vi.fn();
    const renderCard = vi.fn((card: CgKanbanCard) => <span>{card.label}</span>);
    render(<Board onCardMove={onCardMove} onCardOpen={onCardOpen} renderCard={renderCard} />);
    place(screen.getByRole('region', { name: 'Tasks board' }), 0, 0, 1000, 800);
    columns.forEach((column, index) => {
      const section = region(new RegExp(`^${column.title},`, 'u'));
      place(section, 10 + index * 300, 0, 272, 600);
      place(section.querySelector('[role="list"], p')!.parentElement!, 18 + index * 300, 50, 256, 500);
    });
    const card = cardIn('To do', 'todo card 1');
    place(card, 18, 50, 256, 72);
    act(() => { card.querySelector('span')!.dispatchEvent(pointer('pointerdown', { x: 100, y: 80 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 104, y: 84 })); vi.advanceTimersByTime(20); });
    expect(card).toHaveAttribute('data-cg-dragging');
    expect(document.querySelector('[data-cg-drag-ghost]')).toHaveAttribute('aria-hidden', 'true');
    const drawn = renderCard.mock.calls.length;
    // Over the second column, below the middle of its first card (36): before its second.
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 400, y: 50 + 40 })); vi.advanceTimersByTime(20); });
    const line = region(/^In progress,/u).querySelector<HTMLElement>('[data-cg-drop-indicator]')!;
    expect(line.hidden).toBe(false);
    expect(line.style.insetBlockStart).toBe('76px');
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 420, y: 50 + 10 })); vi.advanceTimersByTime(20); });
    expect(line.style.insetBlockStart).toBe('0px');
    // Past the middle of its second card (116): after it, at its end.
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 400, y: 50 + 130 })); vi.advanceTimersByTime(20); });
    expect(line.style.insetBlockStart).toBe('156px');
    expect(renderCard.mock.calls.length).toBe(drawn);
    expect(onCardMove).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 400, y: 50 + 130 })); });
    expect(onCardMove).toHaveBeenCalledTimes(1);
    expect(onCardMove).toHaveBeenCalledWith('todo-0', 'doing', 2, { fromColumnKey: 'todo', fromIndex: 0, source: 'pointer' });
    expect(line.hidden).toBe(true);
    expect(document.querySelector('[data-cg-drag-ghost]')).toBeNull();
    // The click that ends a drag does not open the card.
    fireEvent.click(cardIn('In progress', 'todo card 1'));
    expect(onCardOpen).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(20); });
  });

  it('drops nowhere on its own place, and Escape cancels a drag', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onCardMove = vi.fn();
    render(<Board onCardMove={onCardMove} />);
    place(screen.getByRole('region', { name: 'Tasks board' }), 0, 0, 1000, 800);
    columns.forEach((column, index) => place(region(new RegExp(`^${column.title},`, 'u')), 10 + index * 300, 0, 272, 600));
    const card = cardIn('To do', 'todo card 2');
    act(() => { card.dispatchEvent(pointer('pointerdown', { x: 100, y: 120 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 110, y: 125 })); vi.advanceTimersByTime(20); });
    expect(region(/^To do,/u).querySelector<HTMLElement>('[data-cg-drop-indicator]')!.hidden).toBe(true);
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 110, y: 125 })); });
    expect(onCardMove).not.toHaveBeenCalled();
    act(() => { card.dispatchEvent(pointer('pointerdown', { x: 100, y: 120 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 400, y: 125 })); vi.advanceTimersByTime(20); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 400, y: 125 })); });
    expect(onCardMove).not.toHaveBeenCalled();
    expect(region(/^In progress,/u).querySelector<HTMLElement>('[data-cg-drop-indicator]')!.hidden).toBe(true);
  });

  it('moves a card from its handle menu, as a single-pointer way to move', async () => {
    const onCardMove = vi.fn();
    const archive = vi.fn();
    render(<Board onCardMove={onCardMove} cardMenuItems={() => [{ key: 'archive', text: 'Archive', command: ({ invocation }) => { archive(invocation.context); } }]} />);
    await userEvent.click(within(cardIn('To do', 'todo card 1')).getByRole('button', { name: 'Move todo card 1' }));
    const menu = await screen.findByRole('menu', { hidden: true });
    expect(menu).toHaveAttribute('aria-label', 'Move todo card 1');
    const items = within(menu).getAllByRole('menuitem', { hidden: true });
    expect(items.map((item) => item.textContent)).toEqual(['Move up', 'Move down', 'Move to In progress', 'Move to Done', 'Archive']);
    expect(items[0]).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(within(menu).getByText('Move to Done'));
    expect(onCardMove).toHaveBeenCalledWith('todo-0', 'done', 1, { fromColumnKey: 'todo', fromIndex: 0, source: 'pointer' });
    await waitFor(() => expect(document.activeElement).toBe(cardIn('Done', 'todo card 1')));
    fireEvent.keyDown(document.activeElement!, { key: 'F10', shiftKey: true });
    const again = await screen.findByRole('menu', { hidden: true });
    expect(again).toHaveAttribute('aria-label', 'Move todo card 1');
    await userEvent.click(within(again).getByText('Archive'));
    expect(archive).toHaveBeenCalledWith('todo-0');
  });

  it('draws only the cards in the window of a long column, and the tab stop wherever it is', () => {
    const renderCard = vi.fn((card: CgKanbanCard) => card.label);
    render(<Board initial={makeCards({ todo: 300, doing: 3 })} cardSize={64} renderCard={renderCard} />);
    const todo = region('To do, 300 cards');
    const drawn = within(todo).getAllByRole('listitem');
    expect(drawn.length).toBeGreaterThan(5);
    expect(drawn.length).toBeLessThan(60);
    expect(drawn[0]).toHaveAttribute('aria-setsize', '300');
    expect(todo.querySelector<HTMLElement>('[role="list"]')!.parentElement!.style.blockSize).toBe(`${300 * 72}px`);
    expect(renderCard.mock.calls.length).toBeLessThan(80);
    const scroller = screen.getByRole('region', { name: 'Tasks board' });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 100 * 72 });
    // Scrolled: the column bodies move up by as much (jsdom lays nothing out).
    for (const body of scroller.querySelectorAll('[role="list"]')) place(body.parentElement!, 0, -100 * 72, 256, 300 * 72);
    fireEvent.scroll(scroller);
    const places = within(todo).getAllByRole('listitem').map((item) => Number(item.getAttribute('aria-posinset')));
    expect(places).toContain(1);
    expect(places).toContain(101);
    expect(places).not.toContain(30);
    expect(places.length).toBeLessThan(60);
    expect(cardIn('To do', 'todo card 101').style.insetBlockStart).toBe(`${100 * 72}px`);
  });

  it('focuses a card far down a long column with End, drawing it first', () => {
    render(<Board initial={makeCards({ todo: 300 })} />);
    const first = cardIn('To do', 'todo card 1');
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toHaveAccessibleName('todo card 300');
    expect(document.activeElement).toHaveAttribute('tabindex', '0');
  });

  it('collapses columns, which still take a keyboard drop at their end', async () => {
    const onCardMove = vi.fn();
    const onCollapsedColumnsChange = vi.fn();
    render(<Board onCardMove={onCardMove} collapsible onCollapsedColumnsChange={onCollapsedColumnsChange} />);
    const toggle = screen.getByRole('button', { name: 'Collapse In progress' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(onCollapsedColumnsChange).toHaveBeenLastCalledWith(['doing']);
    expect(screen.getByRole('button', { name: 'Expand In progress' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(region(/^In progress,/u)).queryAllByRole('listitem')).toHaveLength(0);
    const card = cardIn('To do', 'todo card 1');
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'ArrowRight' });
    await waitFor(() => expect(status()).toHaveTextContent('In progress, 3 of 3'));
    fireEvent.keyDown(card, { key: ' ' });
    expect(onCardMove).toHaveBeenCalledWith('todo-0', 'doing', 2, expect.anything());
  });

  it('adds a card from a header, and lists hidden columns with a show button', async () => {
    const onAddCard = vi.fn();
    const onShowColumn = vi.fn();
    render(<Board columns={[...columns, { key: 'archive', title: 'Archive', hidden: true }]} onAddCard={onAddCard} onShowColumn={onShowColumn} renderColumnActions={(column) => <button type="button">{`Menu of ${column.title}`}</button>} />);
    expect(screen.queryByRole('region', { name: /^Archive/u })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'New card in Done' }));
    expect(onAddCard).toHaveBeenCalledWith('done');
    expect(within(region(/^Done,/u)).getByRole('button', { name: 'Menu of Done' })).toBeInTheDocument();
    const hidden = screen.getByRole('region', { name: 'Hidden columns' });
    await userEvent.click(within(hidden).getByRole('button', { name: 'Show Archive' }));
    expect(onShowColumn).toHaveBeenCalledWith('archive');
  });

  it('needs its labels', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = { columns, cards: makeCards({ todo: 1 }), renderCard: (card: CgKanbanCard) => card.label };
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, board: ' ' }} />)).toThrow(/labels\.board/u);
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, emptyColumn: '' }} />)).toThrow(/labels\.emptyColumn/u);
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, cardHandle: undefined }} onCardMove={() => undefined} />)).toThrow(/labels\.cardHandle/u);
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, moveUp: undefined }} onCardMove={() => undefined} />)).toThrow(/labels\.moveUp/u);
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, moveUp: undefined, moveDown: undefined }} onCardMove={() => undefined} fixedOrder />)).not.toThrow();
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, addCard: undefined }} onAddCard={() => undefined} />)).toThrow(/labels\.addCard/u);
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, expandColumn: undefined }} collapsible />)).toThrow(/labels\.expandColumn/u);
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...labels, column: () => '' }} />)).toThrow(/labels\.column/u);
    expect(() => render(<CgKanbanBoard {...base} cards={[{ key: 'a', columnKey: 'todo', label: '' }]} labels={labels} />)).toThrow(/label/u);
    expect(() => render(<CgKanbanBoard {...base} labels={labels} cardSize={0} />)).toThrow(RangeError);
  });
});

// ---- Columns that move, footers, the end of a column, the draft card and drawn titles -------------

const columnLabels: CgKanbanBoardLabels = {
  ...labels,
  columnHandle: (column) => `Move the column ${column.title}`,
  columnHint: 'Space picks the column up and the arrows move it',
  columnPickedUp: (column, index, count) => `Picked up the column ${column.title}, ${index + 1} of ${count}`,
  columnPosition: (column, index, count) => `${column.title}, position ${index + 1} of ${count}`,
  columnMoved: (column, index, count) => `Moved the column ${column.title} to ${index + 1} of ${count}`,
  columnCancelled: (column) => `The column ${column.title} stays`,
  moveColumnPrevious: 'Move left',
  moveColumnNext: 'Move right',
};

/** A board that applies its column moves too, as a caller does. */
function ColumnBoard({ onColumnMove, initialColumns = columns, ...props }: BoardProps & { initialColumns?: CgKanbanColumn[] }) {
  const [list, setList] = useState(initialColumns);
  return <Board
    columns={list}
    labels={columnLabels}
    onColumnMove={(key, toIndex, details) => {
      onColumnMove?.(key, toIndex, details);
      setList((current) => moveKanbanColumn(current, key, toIndex));
    }}
    {...props}
  />;
}

const grip = (title: string) => screen.getByRole('button', { name: `Move the column ${title}` });
const columnOrder = () => [...document.querySelectorAll('section[data-cg-kanban-column]')].map((section) => section.getAttribute('data-cg-kanban-column'));
/** The line among the columns (the columns' own child, not a column's). */
const columnLine = () => screen.getByRole('region', { name: 'Tasks board' }).querySelector<HTMLElement>(':scope > div > [data-cg-drop-indicator]')!;

describe('the column arithmetic', () => {
  it('moves a column among the shown ones, hidden columns keeping their places', () => {
    const list = [{ key: 'a' }, { key: 'h', hidden: true }, { key: 'b' }, { key: 'c' }];
    expect(moveKanbanColumn(list, 'a', 1).map((column) => column.key)).toEqual(['h', 'b', 'a', 'c']);
    expect(moveKanbanColumn(list, 'a', 2).map((column) => column.key)).toEqual(['h', 'b', 'c', 'a']);
    expect(moveKanbanColumn(list, 'c', 0).map((column) => column.key)).toEqual(['c', 'a', 'h', 'b']);
    expect(moveKanbanColumn(list, 'x', 0)).toEqual(list);
  });

  it('finds where a dragged column lands by the middles, right to left in RTL', () => {
    const boxes = [{ left: 0, right: 100 }, { left: 110, right: 210 }, { left: 220, right: 320 }];
    expect(kanbanColumnDropGap(boxes, 40, false)).toBe(0);
    expect(kanbanColumnDropGap(boxes, 160, false)).toBe(1);
    expect(kanbanColumnDropGap(boxes, 170, false)).toBe(2);
    expect(kanbanColumnDropGap(boxes, 900, false)).toBe(3);
    // In RTL the first column is the rightmost: left of its middle is after it.
    const rtl = [...boxes].reverse();
    expect(kanbanColumnDropGap(rtl, 290, true)).toBe(0);
    expect(kanbanColumnDropGap(rtl, 260, true)).toBe(1);
    expect(kanbanColumnDropGap(rtl, 10, true)).toBe(3);
  });

  it('draws the line halfway down a gap, outside the first and the last, mirrored in RTL', () => {
    const boxes = [{ left: 0, right: 100 }, { left: 110, right: 210 }, { left: 220, right: 320 }].map((box, index) => ({ ...box, top: 0, bottom: 100 + index * 50 }));
    expect(kanbanColumnLine(boxes, 1, false, 5)).toEqual({ x: 105, top: 0, bottom: 150 });
    expect(kanbanColumnLine(boxes, 0, false, 5)).toEqual({ x: -5, top: 0, bottom: 100 });
    expect(kanbanColumnLine(boxes, 3, false, 5)).toEqual({ x: 325, top: 0, bottom: 200 });
    const rtl = [...boxes].reverse();
    expect(kanbanColumnLine(rtl, 0, true, 5)).toEqual({ x: 325, top: 0, bottom: 200 });
    expect(kanbanColumnLine(rtl, 1, true, 5)).toEqual({ x: 215, top: 0, bottom: 200 });
    expect(kanbanColumnLine(rtl, 3, true, 5)).toEqual({ x: -5, top: 0, bottom: 100 });
    expect(kanbanColumnLine([], 0, false, 5)).toBeNull();
  });

  it('moves a picked-up column along the row, never up or down', () => {
    expect(kanbanMoveColumn(4, 0, 'previous')).toBeNull();
    expect(kanbanMoveColumn(4, 0, 'next')).toBe(1);
    expect(kanbanMoveColumn(4, 3, 'next')).toBeNull();
    expect(kanbanMoveColumn(4, 2, 'first')).toBe(0);
    expect(kanbanMoveColumn(4, 1, 'last')).toBe(3);
    expect(kanbanMoveColumn(4, 3, 'last')).toBeNull();
    expect(kanbanMoveColumn(4, 1, 'up')).toBeNull();
  });
});

describe('CgKanbanBoard columns', () => {
  it('picks a column up by its grip, carries it with the arrows, drops it and keeps the focus on its grip', async () => {
    const onColumnMove = vi.fn();
    render(<ColumnBoard onColumnMove={onColumnMove} />);
    const handle = grip('To do');
    expect(region(/^To do,/u)).toContainElement(handle);
    expect(handle).toHaveAccessibleDescription('Space picks the column up and the arrows move it');
    expect(handle).toHaveAttribute('aria-haspopup', 'menu');
    expect(handle).not.toHaveAttribute('tabindex', '-1');
    handle.focus();
    fireEvent.keyDown(handle, { key: ' ' });
    expect(region(/^To do,/u)).toHaveAttribute('data-cg-picked');
    await waitFor(() => expect(status()).toHaveTextContent('Picked up the column To do, 1 of 3'));
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await waitFor(() => expect(status()).toHaveTextContent('To do, position 2 of 3'));
    expect(columnLine().hidden).toBe(false);
    expect(columnLine()).toHaveAttribute('data-orientation', 'vertical');
    // Up and down do not move a column; past the last place it stays.
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await waitFor(() => expect(status()).toHaveTextContent('To do, position 3 of 3'));
    expect(onColumnMove).not.toHaveBeenCalled();
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(onColumnMove).toHaveBeenCalledTimes(1);
    expect(onColumnMove).toHaveBeenCalledWith('todo', 2, { fromIndex: 0, source: 'keyboard' });
    expect(Object.isFrozen(onColumnMove.mock.calls[0]![2])).toBe(true);
    expect(columnOrder()).toEqual(['doing', 'done', 'todo']);
    await waitFor(() => expect(status()).toHaveTextContent('Moved the column To do to 3 of 3'));
    expect(document.activeElement).toBe(grip('To do'));
    expect(region(/^To do,/u)).not.toHaveAttribute('data-cg-picked');
    expect(columnLine().hidden).toBe(true);
    // Dropped where it was: no move, and it says so.
    fireEvent.keyDown(handle, { key: ' ' });
    fireEvent.keyDown(handle, { key: ' ' });
    expect(onColumnMove).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(status()).toHaveTextContent('The column To do stays'));
  });

  it('cancels with Escape, Tab or leaving the grip, mirrors the arrows in RTL and skips refused places', async () => {
    const onColumnMove = vi.fn();
    render(<div dir="rtl"><ColumnBoard onColumnMove={onColumnMove} canMoveColumn={(key, toIndex) => !(key === 'done' && toIndex === 1)} /></div>);
    const handle = grip('Done');
    handle.focus();
    fireEvent.keyDown(handle, { key: 'Enter' });
    // In RTL ArrowLeft is the next place: the last column has none.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'Escape' });
    expect(onColumnMove).not.toHaveBeenCalled();
    await waitFor(() => expect(status()).toHaveTextContent('The column Done stays'));
    fireEvent.keyDown(handle, { key: ' ' });
    // ArrowRight is the earlier place; index 1 is refused, so it goes on to the first.
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    await waitFor(() => expect(status()).toHaveTextContent('Done, position 1 of 3'));
    fireEvent.keyDown(handle, { key: ' ' });
    expect(onColumnMove).toHaveBeenCalledWith('done', 0, { fromIndex: 2, source: 'keyboard' });
    expect(columnOrder()).toEqual(['done', 'todo', 'doing']);
    expect(document.activeElement).toBe(grip('Done'));
    fireEvent.keyDown(handle, { key: ' ' });
    fireEvent.keyDown(handle, { key: 'End' });
    fireEvent.keyDown(handle, { key: 'Tab' });
    expect(region(/^Done,/u)).not.toHaveAttribute('data-cg-picked');
    fireEvent.keyDown(handle, { key: ' ' });
    fireEvent.keyDown(handle, { key: 'End' });
    act(() => cardIn('To do', 'todo card 1').focus());
    expect(region(/^Done,/u)).not.toHaveAttribute('data-cg-picked');
    expect(columnLine().hidden).toBe(true);
    expect(onColumnMove).toHaveBeenCalledTimes(1);
  });

  it('drags a column by its header to between two others, with a line down the gap', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onColumnMove = vi.fn();
    const renderCard = vi.fn((card: CgKanbanCard) => <span>{card.label}</span>);
    render(<ColumnBoard onColumnMove={onColumnMove} renderCard={renderCard} collapsible />);
    const scroller = screen.getByRole('region', { name: 'Tasks board' });
    place(scroller, 0, 0, 1000, 800);
    place(scroller.firstElementChild!, 0, 0, 1000, 700);
    columns.forEach((column, index) => place(region(new RegExp(`^${column.title},`, 'u')), 10 + index * 300, 0, 272, 600 - index * 100));
    // A press on a control in the header does not drag.
    act(() => { screen.getByRole('button', { name: 'Collapse To do' }).dispatchEvent(pointer('pointerdown', { x: 60, y: 100 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 300, y: 102 })); vi.advanceTimersByTime(20); });
    expect(document.querySelector('[data-cg-drag-ghost]')).toBeNull();
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 300, y: 102 })); });
    const title = within(region(/^To do,/u)).getByText('To do');
    act(() => { title.dispatchEvent(pointer('pointerdown', { x: 100, y: 100 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 106, y: 102 })); vi.advanceTimersByTime(20); });
    expect(region(/^To do,/u)).toHaveAttribute('data-cg-dragging');
    expect(document.querySelector('body > [data-cg-drag-ghost]')).toHaveAttribute('aria-hidden', 'true');
    const drawn = renderCard.mock.calls.length;
    // Past the middle of the second column (446), before that of the third (746): between them.
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 500, y: 104 })); vi.advanceTimersByTime(20); });
    expect(columnLine().hidden).toBe(false);
    expect(columnLine().style.insetInlineStart).toBe('596px');
    expect(columnLine().style.insetBlockStart).toBe('0px');
    expect(columnLine().style.blockSize).toBe('500px');
    // Back over its own place: no line.
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 200, y: 104 })); vi.advanceTimersByTime(20); });
    expect(columnLine().hidden).toBe(true);
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 500, y: 104 })); vi.advanceTimersByTime(20); });
    expect(renderCard.mock.calls.length).toBe(drawn);
    expect(onColumnMove).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 500, y: 104 })); });
    expect(onColumnMove).toHaveBeenCalledTimes(1);
    expect(onColumnMove).toHaveBeenCalledWith('todo', 1, { fromIndex: 0, source: 'pointer' });
    expect(columnOrder()).toEqual(['doing', 'todo', 'done']);
    expect(columnLine().hidden).toBe(true);
    expect(document.querySelector('[data-cg-drag-ghost]')).toBeNull();
    expect(region(/^To do,/u)).not.toHaveAttribute('data-cg-dragging');
    act(() => { vi.advanceTimersByTime(20); });
  });

  it('places the line from the right in RTL, and still drags cards', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onColumnMove = vi.fn();
    const onCardMove = vi.fn();
    render(<div dir="rtl"><ColumnBoard onColumnMove={onColumnMove} onCardMove={onCardMove} /></div>);
    const scroller = screen.getByRole('region', { name: 'Tasks board' });
    place(scroller, 0, 0, 1000, 800);
    place(scroller.firstElementChild!, 0, 0, 1000, 700);
    // The first column is the rightmost.
    columns.forEach((column, index) => place(region(new RegExp(`^${column.title},`, 'u')), 10 + (2 - index) * 300, 0, 272, 600));
    const title = within(region(/^To do,/u)).getByText('To do');
    act(() => { title.dispatchEvent(pointer('pointerdown', { x: 800, y: 100 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 794, y: 102 })); vi.advanceTimersByTime(20); });
    // Left of the middles of the first two (746 and 446): between the second and the third.
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 300, y: 104 })); vi.advanceTimersByTime(20); });
    expect(columnLine().style.insetInlineStart).toBe(`${1000 - 296}px`);
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 300, y: 104 })); });
    expect(onColumnMove).toHaveBeenCalledWith('todo', 1, { fromIndex: 0, source: 'pointer' });
    act(() => { vi.advanceTimersByTime(20); });
    // A press on a card still drags the card.
    const card = cardIn('To do', 'todo card 1');
    act(() => { card.dispatchEvent(pointer('pointerdown', { x: 400, y: 80 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 390, y: 84 })); vi.advanceTimersByTime(20); });
    expect(card).toHaveAttribute('data-cg-dragging');
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onCardMove).not.toHaveBeenCalled();
  });

  it('moves a column from its grip menu, as a single-pointer way to move', async () => {
    const onColumnMove = vi.fn();
    render(<ColumnBoard onColumnMove={onColumnMove} canMoveColumn={(key, toIndex) => !(key === 'todo' && toIndex === 2)} />);
    await userEvent.click(grip('To do'));
    const menu = await screen.findByRole('menu', { hidden: true });
    expect(menu).toHaveAttribute('aria-label', 'Move the column To do');
    const items = within(menu).getAllByRole('menuitem', { hidden: true });
    expect(items.map((item) => item.textContent)).toEqual(['Move left', 'Move right']);
    expect(items[0]).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(within(menu).getByText('Move right'));
    expect(onColumnMove).toHaveBeenCalledWith('todo', 1, { fromIndex: 0, source: 'pointer' });
    expect(columnOrder()).toEqual(['doing', 'todo', 'done']);
    await waitFor(() => expect(screen.queryByRole('menu', { hidden: true })).toBeNull());
    // Shift+F10 opens it from the keys; a refused place is a disabled item.
    grip('To do').focus();
    fireEvent.keyDown(grip('To do'), { key: 'F10', shiftKey: true });
    const again = await screen.findByRole('menu', { hidden: true });
    expect(again).toHaveAttribute('aria-label', 'Move the column To do');
    expect(within(again).getAllByRole('menuitem', { hidden: true }).map((item) => item.getAttribute('aria-disabled'))).toEqual([null, 'true']);
  });

  it('draws no grip and takes no header drag without onColumnMove, and needs the column labels with it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = render(<Board />);
    expect(screen.queryByRole('button', { name: /^Move the column/u })).toBeNull();
    expect(document.querySelector('[data-cg-kanban-column-head]')).toBeNull();
    unmount();
    const base = { columns, cards: makeCards({ todo: 1 }), renderCard: (card: CgKanbanCard) => card.label, onColumnMove: () => undefined };
    expect(() => render(<CgKanbanBoard {...base} labels={labels} />)).toThrow(/labels\.columnHandle/u);
    for (const name of ['columnHint', 'columnPickedUp', 'columnPosition', 'columnMoved', 'columnCancelled', 'moveColumnPrevious', 'moveColumnNext'] as const) {
      expect(() => render(<CgKanbanBoard {...base} labels={{ ...columnLabels, [name]: undefined }} />)).toThrow(new RegExp(`labels\\.${name}`, 'u'));
    }
    expect(() => render(<CgKanbanBoard {...base} labels={{ ...columnLabels, columnHandle: () => ' ' }} />)).toThrow(/labels\.columnHandle/u);
  });
});

describe('CgKanbanBoard column ends, drafts and titles', () => {
  it('draws a footer at the end of each open column, after its cards', async () => {
    render(<Board collapsible renderColumnFooter={(column) => (column.key === 'done' ? null : <button type="button">{`Load more in ${column.title}`}</button>)} />);
    const todo = region(/^To do,/u);
    const button = within(todo).getByRole('button', { name: 'Load more in To do' });
    expect(within(todo).getByRole('list').compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(todo).getByRole('list')).not.toContainElement(button);
    expect(within(region(/^Done,/u)).queryByRole('button', { name: /^Load more/u })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse To do' }));
    expect(within(region(/^To do,/u)).queryByRole('button', { name: 'Load more in To do' })).toBeNull();
  });

  it('says once when a column comes to its end, and again only when its number of cards changed', () => {
    const onColumnEndReached = vi.fn();
    const paged: CgKanbanColumn[] = [
      { key: 'todo', title: 'To do', count: 9 },
      { key: 'doing', title: 'In progress' },
      { key: 'done', title: 'Done', count: 2 },
      { key: 'later', title: 'Later' },
    ];
    const more = (current: CgKanbanCard[], columnKey: string, count: number) => {
      const have = current.filter((card) => card.columnKey === columnKey).length;
      return [...current, ...Array.from({ length: count }, (_, index) => ({ key: `${columnKey}-${have + index}`, columnKey, label: `${columnKey} card ${have + index + 1}` }))];
    };
    function Paged() {
      const [cards, setCards] = useState(() => makeCards({ todo: 3, doing: 200, done: 2, later: 1 }));
      return <CgKanbanBoard
        columns={paged}
        cards={cards}
        labels={labels}
        renderCard={(card) => card.label}
        collapsible
        defaultCollapsedColumns={['later']}
        onColumnEndReached={(key) => {
          onColumnEndReached(key);
          // Pages of three: the third page brings the column to its count.
          if (key === 'todo') setCards((current) => more(current, 'todo', 3));
        }}
      />;
    }
    render(<Paged />);
    expect(onColumnEndReached.mock.calls).toEqual([['todo'], ['todo']]);
    expect(within(region(/^To do,/u)).getAllByRole('listitem')).toHaveLength(9);
    // A long column says so once it is scrolled to its end, and not again while it has as many cards.
    const scroller = screen.getByRole('region', { name: 'Tasks board' });
    const scrollTo = (top: number) => {
      Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: top });
      for (const body of scroller.querySelectorAll('[role="list"]')) place(body.parentElement!, 0, -top, 256, 200 * 80);
      fireEvent.scroll(scroller);
    };
    scrollTo(8000);
    expect(onColumnEndReached).toHaveBeenCalledTimes(2);
    scrollTo(15_000);
    expect(onColumnEndReached).toHaveBeenLastCalledWith('doing');
    expect(onColumnEndReached).toHaveBeenCalledTimes(3);
    scrollTo(15_400);
    expect(onColumnEndReached).toHaveBeenCalledTimes(3);
    // A collapsed column says nothing until it opens.
    fireEvent.click(screen.getByRole('button', { name: 'Expand Later' }));
    expect(onColumnEndReached).toHaveBeenLastCalledWith('later');
    expect(onColumnEndReached).toHaveBeenCalledTimes(4);
  });

  it('draws a draft card after the cards, outside the list: keys and drags pass it by, Tab reaches it', async () => {
    const onCardMove = vi.fn();
    const draftOf = (column: CgKanbanColumn) => <input aria-label={`New card in ${column.title}`} />;
    const { rerender } = render(<Board onCardMove={onCardMove} draftColumn="doing" renderDraft={draftOf} />);
    const doing = region(/^In progress,/u);
    const input = within(doing).getByRole('textbox', { name: 'New card in In progress' });
    const draft = input.closest<HTMLElement>('[data-cg-kanban-draft]')!;
    expect(draft).not.toHaveAttribute('data-cg-kanban-card');
    expect(draft).not.toHaveAttribute('role');
    expect(within(doing).getByRole('list')).not.toContainElement(input);
    expect(within(doing).getAllByRole('listitem')).toHaveLength(2);
    // Laid out under the cards: the body keeps their block size as its padding.
    expect(draft.parentElement!.style.paddingBlockStart).toBe('160px');
    const last = cardIn('In progress', 'doing card 2');
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: ' ' });
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    fireEvent.keyDown(last, { key: ' ' });
    expect(onCardMove).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    // Keys typed in it are its own.
    fireEvent.keyDown(input, { key: ' ' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(input);
    // A press on it starts no drag.
    act(() => { draft.dispatchEvent(pointer('pointerdown', { x: 10, y: 10 })); });
    act(() => { window.dispatchEvent(pointer('pointermove', { x: 60, y: 60 })); });
    expect(document.querySelector('[data-cg-drag-ghost]')).toBeNull();
    act(() => { window.dispatchEvent(pointer('pointerup', { x: 60, y: 60 })); });
    // Before the cards, outside the column body.
    rerender(<Board onCardMove={onCardMove} draftColumn="doing" renderDraft={draftOf} draftPlacement="start" />);
    const first = within(region(/^In progress,/u)).getByRole('textbox').closest<HTMLElement>('[data-cg-kanban-draft]')!;
    expect(first.nextElementSibling).toContainElement(within(region(/^In progress,/u)).getByRole('list'));
    expect((first.nextElementSibling as HTMLElement).style.blockSize).toBe('160px');
    // A collapsed column draws none.
    rerender(<Board onCardMove={onCardMove} draftColumn="doing" renderDraft={draftOf} collapsible collapsedColumns={['doing']} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('stands a draft card for the empty text of an empty column', () => {
    const draftOf = (column: CgKanbanColumn) => <input aria-label={`New card in ${column.title}`} />;
    render(<Board initial={makeCards({ todo: 2 })} draftColumn="done" renderDraft={draftOf} draftPlacement="start" />);
    const done = region(/^Done,/u);
    expect(within(done).getByRole('textbox', { name: 'New card in Done' })).toBeInTheDocument();
    expect(within(done).queryByText('No cards')).toBeNull();
    expect(within(region(/^In progress,/u)).getByText('No cards')).toBeInTheDocument();
    // No hole left where the empty text was.
    const body = done.querySelector<HTMLElement>('[data-cg-kanban-draft]')!.nextElementSibling as HTMLElement;
    expect(body.style.minBlockSize).toBe('0px');
  });

  it('scrolls a draft card into view when it opens at the end of a long column', () => {
    const rect = (top: number, height: number) => ({ left: 0, top, right: 256, bottom: top + height, width: 256, height, x: 0, y: top, toJSON: () => ({}) });
    // jsdom lays nothing out: every box is empty but the draft's (and those placed below).
    const empty = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.dataset.cgKanbanDraft !== undefined ? rect(2000, 60) : empty;
    });
    const draftOf = (column: CgKanbanColumn) => <input aria-label={`New card in ${column.title}`} />;
    const { rerender } = render(<Board renderDraft={draftOf} draftColumn={null} />);
    const scroller = screen.getByRole('region', { name: 'Tasks board' });
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as typeof scroller.scrollBy;
    place(scroller, 0, 0, 1000, 400);
    place(region(/^To do,/u), 10, 0, 272, 3000);
    place(within(region(/^To do,/u)).getByRole('list').parentElement!, 18, 50, 256, 2000);
    rerender(<Board renderDraft={draftOf} draftColumn="todo" />);
    // The draft ends at 2060, below the board's 400: scrolled by 2060 - 400 and the pad.
    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: 1668 });
  });

  it('draws the caller’s column titles in headers and in the hidden list, while regions keep their names', () => {
    render(<Board
      columns={[...columns, { key: 'archive', title: 'Archive', hidden: true }]}
      onShowColumn={() => undefined}
      renderColumnTitle={(column) => <span data-testid={`chip-${column.key}`}>{`[${column.title}]`}</span>}
    />);
    const todo = region('To do, 4 cards');
    expect(within(todo).getByTestId('chip-todo')).toHaveTextContent('[To do]');
    expect(within(todo).queryByText('To do')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Hidden columns' })).getByTestId('chip-archive')).toHaveTextContent('[Archive]');
  });
});
