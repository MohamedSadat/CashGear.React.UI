import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgEmojiPicker, emojiStep } from './CgEmojiPicker';
import { cgPageIcons } from './pageIcons';
import type { CgEmojiPickerLabels } from './CgEmojiPicker.types';

const labels: CgEmojiPickerLabels = { search: 'ابحث عن رمز', grid: 'الرموز', noMatch: 'لا رمز مطابق', recent: 'المستخدمة مؤخراً', remove: 'إزالة' };

describe('cgPageIcons', () => {
  it('names every icon in Arabic and English, in known groups, without repeats', () => {
    const ar = cgPageIcons('ar');
    const en = cgPageIcons('en');
    expect(ar.items.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ar.items.map((item) => item.emoji)).size).toBe(ar.items.length);
    const groups = new Set(ar.groups.map((group) => group.key));
    for (const item of ar.items) {
      expect(item.name.trim(), item.emoji).not.toBe('');
      expect(groups.has(item.group!), item.emoji).toBe(true);
    }
    expect(ar.items[0]).toMatchObject({ emoji: '📄', name: 'صفحة' });
    expect(en.items[0]).toMatchObject({ emoji: '📄', name: 'Page' });
    expect(ar.items[0]!.keywords).toContain('Page');
    expect(en.groups[0]!.label).toBe('Documents');
  });
});

describe('emojiStep', () => {
  const sections = [{ items: [1, 2, 3] }, { items: [4, 5, 6, 7, 8] }];
  it('walks rows within and across sections, mirrored in right to left', () => {
    expect(emojiStep(sections, 0, 'ArrowRight', 4, false)).toBe(1);
    expect(emojiStep(sections, 1, 'ArrowRight', 4, true)).toBe(0);
    expect(emojiStep(sections, 2, 'ArrowDown', 4, false)).toBe(5);
    expect(emojiStep(sections, 3, 'ArrowDown', 4, false)).toBe(7);
    expect(emojiStep(sections, 7, 'ArrowUp', 4, false)).toBe(3);
    expect(emojiStep(sections, 4, 'ArrowUp', 4, false)).toBe(1);
    expect(emojiStep(sections, 1, 'ArrowUp', 4, false)).toBe('search');
    expect(emojiStep(sections, 3, 'End', 4, false)).toBe(7);
    expect(emojiStep(sections, 3, 'x', 4, false)).toBeNull();
  });
});

describe('CgEmojiPicker', () => {
  const icons = cgPageIcons('ar');

  it('draws named, grouped emoji buttons, recent ones first, with one tab stop', () => {
    render(<CgEmojiPicker items={icons.items} groups={icons.groups} recent={[icons.items[5]!]} labels={labels} onSelect={() => undefined} value="📄" />);
    const grid = screen.getByRole('group', { name: 'الرموز' });
    expect(within(grid).getByRole('group', { name: 'المستخدمة مؤخراً' })).toBeInTheDocument();
    expect(within(grid).getByRole('group', { name: 'مستندات' })).toBeInTheDocument();
    const page = within(within(grid).getByRole('group', { name: 'مستندات' })).getByRole('button', { name: 'صفحة' });
    expect(page).toHaveAttribute('aria-pressed', 'true');
    expect(page).toHaveAttribute('title', 'صفحة');
    expect(grid.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
  });

  it('searches names and keywords in either language, and chooses the first match with Enter', async () => {
    const onSelect = vi.fn();
    render(<CgEmojiPicker items={icons.items} groups={icons.groups} labels={labels} onSelect={onSelect} />);
    const search = screen.getByRole('searchbox', { name: 'ابحث عن رمز' });
    await userEvent.type(search, 'صاروخ');
    expect(screen.getAllByRole('button', { name: /صاروخ/u })).toHaveLength(1);
    await userEvent.clear(search);
    await userEvent.type(search, 'budget{Enter}');
    expect(onSelect).toHaveBeenCalledWith('💰', expect.objectContaining({ name: 'كيس نقود' }));
    await userEvent.clear(search);
    await userEvent.type(search, 'لا يوجد شيء كهذا');
    expect(screen.getByText('لا رمز مطابق')).toBeInTheDocument();
  });

  it('moves focus with the arrows from the search box into the grid, and chooses with Enter', async () => {
    const onSelect = vi.fn();
    render(<CgEmojiPicker items={icons.items.slice(0, 12)} labels={labels} columns={4} onSelect={onSelect} />);
    act(() => screen.getByRole('searchbox').focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'صفحة' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    expect(screen.getAllByRole('button').filter((button) => button.hasAttribute('data-cg-emoji-index'))[5]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(icons.items[5]!.emoji, icons.items[5]);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('removes the icon, and reports Escape', () => {
    const onSelect = vi.fn();
    const onEscape = vi.fn();
    render(<CgEmojiPicker items={icons.items} labels={labels} onSelect={onSelect} onEscape={onEscape} />);
    fireEvent.click(screen.getByRole('button', { name: 'إزالة' }));
    expect(onSelect).toHaveBeenCalledWith(null);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('needs its labels and sound columns', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgEmojiPicker items={[]} labels={{ ...labels, grid: '' }} onSelect={() => undefined} />)).toThrow(/labels/u);
    expect(() => render(<CgEmojiPicker items={[]} recent={[{ emoji: 'x', name: 'x' }]} labels={{ search: 'a', grid: 'b', noMatch: 'c' }} onSelect={() => undefined} />)).toThrow(/recent/u);
    expect(() => render(<CgEmojiPicker items={[]} labels={labels} columns={0} onSelect={() => undefined} />)).toThrow(RangeError);
  });
});
