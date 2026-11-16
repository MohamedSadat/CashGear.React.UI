import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgCommandMenu } from './CgCommandMenu';
import type { CgCommandMenuHandle, CgCommandMenuItem } from './CgCommandMenu.types';
import { commandMatches, groupCommands } from './commandFilter';

const blocks: CgCommandMenuItem[] = [
  { key: 'text', label: 'نص', group: 'أساسي', icon: 'text', keywords: ['paragraph'] },
  { key: 'h1', label: 'عنوان 1', group: 'أساسي', icon: 'heading-1', keywords: ['h1', 'heading'], shortcut: 'Ctrl+Alt+1' },
  { key: 'h2', label: 'عنوان 2', group: 'أساسي', icon: 'heading-2', keywords: ['h2'] },
  { key: 'image', label: 'صورة', group: 'وسائط', icon: 'image', detail: 'ارفع صورة أو الصق رابطاً' },
  { key: 'file', label: 'ملف', group: 'وسائط', icon: 'file', disabled: true },
  { key: 'callout', label: 'تنبيه', group: 'أساسي', icon: '💡' },
];

describe('command filter', () => {
  it('matches word starts in the label and keywords, ignoring case and Arabic marks', () => {
    expect(commandMatches(blocks[1]!, 'عنو')).toBe(true);
    expect(commandMatches(blocks[1]!, 'H1')).toBe(true);
    expect(commandMatches(blocks[1]!, 'head')).toBe(true);
    expect(commandMatches({ key: 'x', label: 'عُنْوَان' }, 'عنوان')).toBe(true);
    expect(commandMatches(blocks[3]!, 'نص')).toBe(false);
    expect(commandMatches(blocks[0]!, '')).toBe(true);
  });

  it('groups in the order each group first appears', () => {
    const { groups, flat } = groupCommands(blocks);
    expect(groups.map((group) => group.name)).toEqual(['أساسي', 'وسائط']);
    expect(flat.map((item) => item.key)).toEqual(['text', 'h1', 'h2', 'callout', 'image', 'file']);
  });
});

describe('CgCommandMenu', () => {
  it('draws a named listbox of named groups, the first enabled option active', () => {
    render(<CgCommandMenu items={blocks} label="الكتل" emptyText="لا توجد أوامر" onSelect={() => undefined} />);
    const list = screen.getByRole('listbox', { name: 'الكتل' });
    const groups = within(list).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-labelledby') && document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent)).toEqual(['أساسي', 'وسائط']);
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveTextContent('Ctrl+Alt+1');
    expect(options[4]).toHaveTextContent('ارفع صورة');
    expect(options[5]).toHaveAttribute('aria-disabled', 'true');
    expect(options[3]).toHaveTextContent('💡');
  });

  it('is driven by keys forwarded from a host that keeps focus, skipping disabled options', () => {
    const ref = createRef<CgCommandMenuHandle>();
    const onSelect = vi.fn();
    const onActive = vi.fn();
    render(<CgCommandMenu ref={ref} items={blocks} label="الكتل" emptyText="x" onSelect={onSelect} onActiveDescendantChange={onActive} selectOnTab />);
    const key = (name: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key: name, cancelable: true, ...init });
      let used = false;
      act(() => { used = ref.current!.handleKeyDown(event); });
      return { used, prevented: event.defaultPrevented };
    };
    expect(key('ArrowDown')).toEqual({ used: true, prevented: true });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(onActive).toHaveBeenLastCalledWith(ref.current!.activeDescendantId);
    key('End');
    expect(screen.getAllByRole('option')[4]).toHaveAttribute('aria-selected', 'true');
    key('ArrowDown');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    key('ArrowUp');
    key('Enter');
    expect(onSelect).toHaveBeenLastCalledWith(blocks[3], { source: 'keyboard' });
    key('Home');
    key('Tab');
    expect(onSelect).toHaveBeenLastCalledWith(blocks[0], { source: 'keyboard' });
    expect(key('a')).toEqual({ used: false, prevented: false });
    expect(key('Escape').used).toBe(false);
  });

  it('filters by its query, starts the active option over, and shows the empty text', () => {
    const { rerender } = render(<CgCommandMenu items={blocks} query="" label="الكتل" emptyText="لا توجد أوامر" onSelect={() => undefined} />);
    rerender(<CgCommandMenu items={blocks} query="عنوان" label="الكتل" emptyText="لا توجد أوامر" onSelect={() => undefined} />);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['عنوان 1Ctrl+Alt+1', 'عنوان 2']);
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    rerender(<CgCommandMenu items={blocks} query="جدول محوري" label="الكتل" emptyText="لا توجد أوامر" onSelect={() => undefined} />);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('لا توجد أوامر');
  });

  it('shows items as given with filter={false}', () => {
    render(<CgCommandMenu items={blocks.slice(0, 2)} query="لا يطابق" filter={false} label="النتائج" emptyText="x" onSelect={() => undefined} />);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('as a palette, keeps focus in its search box, which owns the active option', async () => {
    const onSelect = vi.fn();
    const onQueryChange = vi.fn();
    render(<CgCommandMenu items={blocks} searchable searchLabel="ابحث" label="النتائج" emptyText="x" onSelect={onSelect} onQueryChange={onQueryChange} />);
    const search = screen.getByRole('combobox', { name: 'ابحث' });
    await userEvent.click(search);
    await userEvent.keyboard('صو');
    expect(onQueryChange).toHaveBeenLastCalledWith('صو');
    const option = screen.getByRole('option', { name: /صورة/u });
    expect(search).toHaveAttribute('aria-activedescendant', option.id);
    expect(search).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(search).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(blocks[3], { source: 'keyboard' });
    expect(search).toHaveFocus();
  });

  it('chooses with the pointer without taking focus, and follows the pointer', () => {
    const onSelect = vi.fn();
    render(<><input aria-label="محرر" /><CgCommandMenu items={blocks} label="الكتل" emptyText="x" onSelect={onSelect} /></>);
    const editor = screen.getByRole('textbox', { name: 'محرر' });
    act(() => editor.focus());
    const image = screen.getByRole('option', { name: /صورة/u });
    fireEvent.mouseMove(image);
    expect(image).toHaveAttribute('aria-selected', 'true');
    const down = fireEvent.mouseDown(image);
    expect(down).toBe(false);
    fireEvent.click(image);
    expect(onSelect).toHaveBeenCalledWith(blocks[3], { source: 'pointer' });
    fireEvent.click(screen.getByRole('option', { name: /ملف/u }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(editor).toHaveFocus();
  });

  it('acts on an Enter pressed while loading once the results are in', () => {
    const ref = createRef<CgCommandMenuHandle>();
    const onSelect = vi.fn();
    function Host() {
      const [loading, setLoading] = useState(true);
      return <><button type="button" onClick={() => setLoading(false)}>وصلت</button><CgCommandMenu ref={ref} items={loading ? [] : blocks.slice(3, 4)} loading={loading} loadingText="جارٍ البحث" label="النتائج" emptyText="x" filter={false} onSelect={onSelect} /></>;
    }
    render(<Host />);
    expect(screen.getByRole('status')).toHaveTextContent('جارٍ البحث');
    act(() => { ref.current!.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })); });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'وصلت' }));
    expect(onSelect).toHaveBeenCalledWith(blocks[3], { source: 'keyboard' });
  });

  it('dismisses on Escape when asked, and floats at an anchor', () => {
    const onDismiss = vi.fn();
    const ref = createRef<CgCommandMenuHandle>();
    render(<CgCommandMenu ref={ref} anchor={{ x: 40, y: 60, width: 0, height: 18 }} items={blocks} label="الكتل" emptyText="x" onSelect={() => undefined} onDismiss={onDismiss} />);
    act(() => { ref.current!.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); });
    expect(onDismiss).toHaveBeenCalledWith('escape');
    expect(document.querySelector('[data-cg-overlay-surface="flyout"] [role="listbox"]')).not.toBeNull();
  });

  it('needs a label, and a search label when searchable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgCommandMenu items={blocks} label="" emptyText="x" onSelect={() => undefined} />)).toThrow(/label/u);
    expect(() => render(<CgCommandMenu items={blocks} label="x" searchable emptyText="x" onSelect={() => undefined} />)).toThrow(/searchLabel/u);
  });

  it('acts only on the keys it is given, leaving the others to the editor', () => {
    const ref = createRef<CgCommandMenuHandle>();
    render(<CgCommandMenu ref={ref} items={blocks} label="الكتل" emptyText="x" onSelect={() => undefined} handledKeys={['ArrowUp', 'ArrowDown', 'Enter', 'Escape']} />);
    const key = (name: string) => {
      const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
      let used = false;
      act(() => { used = ref.current!.handleKeyDown(event); });
      return { used, prevented: event.defaultPrevented };
    };
    expect(key('End')).toEqual({ used: false, prevented: false });
    expect(key('Home')).toEqual({ used: false, prevented: false });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    expect(key('ArrowDown').used).toBe(true);
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });
});
