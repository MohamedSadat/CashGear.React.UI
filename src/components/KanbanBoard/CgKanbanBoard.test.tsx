import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgKanbanBoard } from './CgKanbanBoard';
import type { CgKanbanBoardLabels, CgKanbanBoardProps, CgKanbanCard, CgKanbanColumn } from './CgKanbanBoard.types';
import {
  groupKanbanCards,
  kanbanCardsInWindow,
  kanbanColumnLayout,
  kanbanDropGap,
  kanbanGapOf,
  kanbanKeyMove,
  kanbanMoveDrop,
  kanbanMoveFocus,
  kanbanNearestColumn,
  kanbanTargetIndex,
  moveKanbanCard,
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
