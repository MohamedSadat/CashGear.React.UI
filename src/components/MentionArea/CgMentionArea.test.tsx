import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgMentionArea } from './CgMentionArea';
import type { CgMentionAreaHandle, CgMentionAreaSuggestion } from './CgMentionArea.types';
import { queryAt, readValue, writeValue } from './mentionDom';

const people: CgMentionAreaSuggestion[] = [
  { key: 'u1', label: 'ليلى حسن', group: 'الأشخاص', mention: { kind: 'user', id: 'u1' }, detail: 'layla@example.com' },
  { key: 'u2', label: 'سامي يوسف', group: 'الأشخاص', mention: { kind: 'user', id: 'u2' } },
  { key: 'p1', label: 'خطة الربع', group: 'الصفحات', icon: '📄', mention: { kind: 'page', id: 'p1' }, text: '📄 خطة الربع' },
];
const suggest = (query: string) => people.filter((item) => item.label.includes(query));

/** Types `text` at the end of the area's last text node and puts the caret after it. */
function type(area: HTMLElement, text: string) {
  let node = Array.from(area.childNodes).reverse().find((child) => child.nodeType === 3) as Text | undefined;
  if (!node) { node = document.createTextNode(''); area.append(node); }
  node.data += text;
  const range = document.createRange();
  range.setStart(node, node.length);
  range.collapse(true);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
  fireEvent.input(area);
}

describe('mention DOM', () => {
  it('finds a trigger at a word start before the caret', () => {
    expect(queryAt('مرحباً @لي', 10, ['@'])).toEqual({ trigger: '@', query: 'لي', start: 7 });
    expect(queryAt('email@host', 10, ['@'])).toBeNull();
    expect(queryAt('(#tag', 5, ['@', '#'])).toEqual({ trigger: '#', query: 'tag', start: 1 });
  });

  it('writes and reads text, line breaks and mentions', () => {
    const root = document.createElement('div');
    const value = ['أهلاً ', { kind: 'user', id: 'u1', text: '@ليلى' }, ' انظري\nالسطر الثاني'];
    writeValue(root, value, 'm');
    expect(readValue(root)).toEqual(value);
    root.innerHTML = '<div>سطر</div><div>آخر<br></div>';
    expect(readValue(root)).toEqual(['سطر\nآخر']);
  });
});

describe('CgMentionArea', () => {
  it('is a named multi-line text box with a placeholder while empty', () => {
    render(<CgMentionArea label="تعليق" placeholder="اكتب تعليقاً" listLabel="الإشارات" suggest={suggest} />);
    const area = screen.getByRole('textbox', { name: 'تعليق' });
    expect(area).toHaveAttribute('aria-multiline', 'true');
    expect(area).toHaveAttribute('contenteditable', 'true');
    expect(area).toHaveAttribute('data-empty');
    type(area, 'نص');
    expect(area).not.toHaveAttribute('data-empty');
  });

  it('offers grouped suggestions after "@" and inserts the chosen mention with the keyboard', () => {
    const onValueChange = vi.fn();
    const ref = createRef<CgMentionAreaHandle>();
    render(<CgMentionArea ref={ref} label="تعليق" listLabel="الإشارات" suggest={suggest} onValueChange={onValueChange} />);
    const area = screen.getByRole('textbox');
    act(() => area.focus());
    type(area, 'شكراً @');
    const list = screen.getByRole('listbox', { name: 'الإشارات' });
    expect(area).toHaveAttribute('aria-controls', list.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    type(area, 'سا');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(area).toHaveAttribute('aria-activedescendant', screen.getByRole('option').id);
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(ref.current!.getValue()).toEqual(['شكراً ', { kind: 'user', id: 'u2', text: '@سامي يوسف' }, ' ']);
    expect(onValueChange).toHaveBeenLastCalledWith(['شكراً ', { kind: 'user', id: 'u2', text: '@سامي يوسف' }, ' ']);
    expect(area.querySelector('[data-cg-mention-id="u2"]')).toHaveAttribute('contenteditable', 'false');
  });

  it('takes a suggestion with the pointer, and its own atom text', () => {
    const ref = createRef<CgMentionAreaHandle>();
    render(<CgMentionArea ref={ref} label="تعليق" listLabel="الإشارات" suggest={suggest} />);
    const area = screen.getByRole('textbox');
    act(() => area.focus());
    type(area, '@خطة');
    fireEvent.click(screen.getByRole('option', { name: /خطة الربع/u }));
    expect(ref.current!.getValue()).toEqual([{ kind: 'page', id: 'p1', text: '📄 خطة الربع' }, ' ']);
  });

  it('closes the list on Escape first, then cancels; submits on Ctrl+Enter', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(<CgMentionArea label="تعليق" listLabel="الإشارات" suggest={suggest} onCancel={onCancel} onSubmit={onSubmit} defaultValue={['مرحباً']} />);
    const area = screen.getByRole('textbox');
    act(() => area.focus());
    type(area, ' @');
    fireEvent.keyDown(area, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(area, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith(['مرحباً @']);
  });

  it('pastes plain text, and clears and replaces its content through the handle', () => {
    const ref = createRef<CgMentionAreaHandle>();
    render(<CgMentionArea ref={ref} label="تعليق" listLabel="الإشارات" suggest={suggest} />);
    const area = screen.getByRole('textbox');
    act(() => area.focus());
    const range = document.createRange();
    range.selectNodeContents(area);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    fireEvent.paste(area, { clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'نص ملصوق' : '<b>x</b>') } });
    expect(ref.current!.getValue()).toEqual(['نص ملصوق']);
    act(() => ref.current!.setValue(['أ', { kind: 'user', id: 'u1', text: '@ليلى' }]));
    expect(area.querySelector('[data-cg-mention-id]')).toHaveTextContent('@ليلى');
    act(() => ref.current!.clear());
    expect(ref.current!.getValue()).toEqual([]);
    expect(area).toHaveAttribute('data-empty');
  });

  it('is not editable when disabled', () => {
    render(<CgMentionArea label="تعليق" listLabel="الإشارات" suggest={suggest} disabled />);
    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-disabled', 'true');
  });
});
