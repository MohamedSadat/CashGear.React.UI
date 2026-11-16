import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgSortableList, gapToIndex } from './CgSortableList';

interface Prop { id: string; name: string }
const props: Prop[] = [{ id: 'title', name: 'العنوان' }, { id: 'status', name: 'الحالة' }, { id: 'owner', name: 'المسؤول' }, { id: 'due', name: 'الموعد' }];

function Host({ onMove = vi.fn(), canMove }: { onMove?: (key: string, to: number) => void; canMove?: (key: string, to: number) => boolean }) {
  const [items, setItems] = useState(props);
  return <CgSortableList
    items={items}
    getKey={(item) => item.id}
    label="الخصائص"
    handleLabel={(item) => `نقل ${item.name}`}
    moveAnnouncement={(item, to, count) => `${item.name}: ${to + 1} من ${count}`}
    isItemFixed={(item) => item.id === 'title'}
    canMove={canMove}
    renderItem={(item) => <span>{item.name}</span>}
    onMove={(key, to, details) => {
      onMove(key, to);
      setItems((current) => { const next = current.filter((item) => item.id !== key); next.splice(to, 0, current[details.fromIndex]!); return next; });
    }}
  />;
}

const names = () => within(screen.getByRole('list', { name: 'الخصائص' })).getAllByRole('listitem').map((item) => item.textContent);

describe('gapToIndex', () => {
  it('turns a drop gap into the place after the move', () => {
    expect(gapToIndex(1, 0)).toBe(0);
    expect(gapToIndex(1, 1)).toBe(1);
    expect(gapToIndex(1, 2)).toBe(1);
    expect(gapToIndex(1, 4)).toBe(3);
  });
});

describe('CgSortableList', () => {
  it('draws a named list with a named handle on each movable item', () => {
    render(<Host />);
    expect(names()).toEqual(['العنوان', 'الحالة', 'المسؤول', 'الموعد']);
    expect(screen.queryByRole('button', { name: 'نقل العنوان' })).toBeNull();
    expect(screen.getByRole('button', { name: 'نقل الحالة' })).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Home End');
  });

  it('moves an item with the arrows on its handle, keeping focus on the handle, and announces it', async () => {
    const onMove = vi.fn();
    render(<Host onMove={onMove} canMove={(_key, to) => to > 0} />);
    act(() => screen.getByRole('button', { name: 'نقل الحالة' }).focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(onMove).toHaveBeenLastCalledWith('status', 2);
    expect(names()).toEqual(['العنوان', 'المسؤول', 'الحالة', 'الموعد']);
    expect(screen.getByRole('button', { name: 'نقل الحالة' })).toHaveFocus();
    await act(() => new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); }));
    expect(screen.getByRole('status')).toHaveTextContent('الحالة: 3 من 4');
    await userEvent.keyboard('{End}');
    expect(names()).toEqual(['العنوان', 'المسؤول', 'الموعد', 'الحالة']);
    await userEvent.keyboard('{Home}');
    expect(onMove).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(names()).toEqual(['العنوان', 'الحالة', 'المسؤول', 'الموعد']);
  });

  it('moves an item by dragging its handle, with a drop line where it will land', () => {
    const onMove = vi.fn();
    render(<Host onMove={onMove} />);
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    rows.forEach((row, index) => { row.getBoundingClientRect = () => ({ x: 0, y: index * 30, left: 0, top: index * 30, right: 200, bottom: index * 30 + 30, width: 200, height: 30, toJSON: () => ({}) }); });
    document.elementFromPoint = (_x: number, y: number) => rows[Math.min(rows.length - 1, Math.floor(y / 30))]!;
    const handle = screen.getByRole('button', { name: 'نقل المسؤول' });
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 5, clientY: 75 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5, clientY: 35 });
    expect(rows[1]).toHaveAttribute('data-drop', 'before');
    expect(rows[2]).toHaveAttribute('data-dragging');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5, clientY: 115 });
    expect(rows[3]).toHaveAttribute('data-drop', 'after');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 5, clientY: 115 });
    expect(onMove).toHaveBeenCalledWith('owner', 3);
    expect(names()).toEqual(['العنوان', 'الحالة', 'الموعد', 'المسؤول']);
  });

  it('draws no handles when disabled, and needs a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<CgSortableList disabled items={props} getKey={(item) => item.id} label="x" handleLabel={() => 'x'} renderItem={(item) => item.name} onMove={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(() => render(<CgSortableList items={props} getKey={(item) => item.id} label="" handleLabel={() => 'x'} renderItem={(item) => item.name} onMove={() => undefined} />)).toThrow(/label/u);
  });
});
