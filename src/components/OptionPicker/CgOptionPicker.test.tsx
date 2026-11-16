import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgItemPicker } from './CgItemPicker';
import { CgOptionPicker, leastUsedColour, moveKey } from './CgOptionPicker';
import type { CgOptionPickerChange, CgOptionPickerLabels, CgOptionPickerOption } from './CgOptionPicker.types';

const labels: CgOptionPickerLabels = {
  search: 'ابحث أو أنشئ خياراً',
  searchOnly: 'ابحث',
  list: 'الخيارات',
  create: (name) => `إنشاء «${name}»`,
  noMatch: 'لا خيار مطابق',
  none: 'لا خيارات بعد',
  optionMenu: (name) => `خيارات ${name}`,
  drag: (name) => `نقل ${name}`,
  remove: (name) => `إزالة ${name}`,
  back: 'رجوع',
  name: 'اسم الخيار',
  colour: 'اللون',
  group: 'المجموعة',
  delete: 'حذف الخيار',
  moved: (name, to, count) => `${name}: ${to + 1} من ${count}`,
};
const colours = [
  { key: 'gray', label: 'رمادي', background: '#eef0f3' },
  { key: 'blue', label: 'أزرق', background: '#dbeafe' },
  { key: 'green', label: 'أخضر', background: '#dcfce7' },
];
const groups = [{ key: 'todo', label: 'للتنفيذ' }, { key: 'doing', label: 'قيد التنفيذ' }, { key: 'done', label: 'تم' }];
const initial: CgOptionPickerOption[] = [
  { key: 'a', name: 'جديد', colour: 'gray', group: 'todo' },
  { key: 'b', name: 'قيد العمل', colour: 'blue', group: 'doing' },
  { key: 'c', name: 'مكتمل', colour: 'green', group: 'done' },
];

function Host({ multiple = false, manage = false, onChange = vi.fn(), withGroups = true }: { multiple?: boolean; manage?: boolean; onChange?: (options: CgOptionPickerOption[], change: CgOptionPickerChange) => void; withGroups?: boolean }) {
  const [options, setOptions] = useState(initial);
  const [selected, setSelected] = useState<string[]>(['b']);
  return <>
    <CgOptionPicker
      options={options}
      selected={selected}
      multiple={multiple}
      canManage
      manage={manage}
      colours={colours}
      groups={withGroups ? groups : undefined}
      labels={labels}
      createOption={(name) => ({ key: `new-${name}`, name, colour: 'gray', group: 'todo' })}
      onSelectionChange={setSelected}
      onOptionsChange={(next, change) => { onChange(next, change); setOptions(next); }}
    />
    <output data-testid="selected">{selected.join(',')}</output>
    <output data-testid="order">{options.map((option) => option.key).join(',')}</output>
  </>;
}

describe('option helpers', () => {
  it('picks the least-used colour and moves keys', () => {
    expect(leastUsedColour(initial, colours)).toBe('gray');
    expect(leastUsedColour([...initial, { key: 'd', name: 'x', colour: 'gray' }], colours)).toBe('blue');
    expect(moveKey(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveKey(['a', 'b', 'c'], 'z', 0)).toEqual(['a', 'b', 'c']);
  });
});

describe('CgOptionPicker', () => {
  it('lists options under their groups, chosen ones checked and drawn as chips', () => {
    render(<Host />);
    const list = screen.getByRole('listbox', { name: 'الخيارات' });
    expect(within(list).getAllByRole('group').map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent)).toEqual(['للتنفيذ', 'قيد التنفيذ', 'تم']);
    expect(within(list).getByRole('option', { name: /قيد العمل/u })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'إزالة قيد العمل' })).toBeInTheDocument();
    const combobox = screen.getByRole('combobox', { name: labels.search });
    expect(combobox).toHaveAttribute('aria-activedescendant', within(list).getAllByRole('option')[0]!.id);
  });

  it('chooses with the keyboard: one replaces the choice, several toggle; Backspace removes the last chip', async () => {
    const { unmount } = render(<Host />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('selected')).toHaveTextContent(/^c$/u);
    unmount();
    render(<Host multiple />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('selected')).toHaveTextContent('b,a');
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByTestId('selected')).toHaveTextContent(/^b$/u);
  });

  it('creates an option from the text typed and chooses it', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('مؤجل');
    expect(screen.getByRole('option', { name: 'إنشاء «مؤجل»' })).toHaveAttribute('aria-selected', 'false');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ key: 'new-مؤجل', name: 'مؤجل' })]), { kind: 'create', key: 'new-مؤجل' });
    expect(screen.getByTestId('selected')).toHaveTextContent('new-مؤجل');
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('filters, and offers no create row for an existing name', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('مكتمل');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('ة');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['إنشاء «مكتملة»']);
  });

  it('reorders with Alt+arrows, and announces the move', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} withGroups={false} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onChange).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'reorder', key: 'a', toIndex: 1 });
    expect(screen.getByTestId('order')).toHaveTextContent('b,a,c');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1]!.id);
  });

  it('reorders by dragging a handle', () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} withGroups={false} />);
    const rows = screen.getAllByRole('option');
    rows.forEach((row, index) => { row.getBoundingClientRect = () => ({ x: 0, y: index * 30, left: 0, top: index * 30, right: 200, bottom: index * 30 + 30, width: 200, height: 30, toJSON: () => ({}) }); });
    document.elementFromPoint = (_x: number, y: number) => rows[Math.min(rows.length - 1, Math.floor(y / 30))]!;
    const handle = rows[0]!.querySelector<HTMLElement>('[data-cg-option-handle]')!;
    expect(handle).toHaveAttribute('title', 'نقل جديد');
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 15 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 85 });
    expect(rows[2]).toHaveAttribute('data-drop', 'after');
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 85 });
    expect(onChange).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'reorder', key: 'a', toIndex: 2 });
  });

  it('edits an option: rename, regroup, recolour and delete, then back', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{F2}');
    const editor = screen.getByRole('group', { name: 'خيارات جديد' });
    const name = within(editor).getByRole('textbox', { name: 'اسم الخيار' });
    expect(name).toHaveFocus();
    await userEvent.click(within(editor).getByRole('radio', { name: 'تم' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'regroup', key: 'a' });
    await userEvent.click(within(editor).getByRole('radio', { name: 'أزرق' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.any(Array), { kind: 'recolour', key: 'a' });
    await userEvent.clear(name);
    await userEvent.type(name, 'جديد جداً{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ key: 'a', name: 'جديد جداً', colour: 'blue', group: 'done' })]), { kind: 'rename', key: 'a' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /قيد العمل/u }).querySelector('[data-cg-option-menu]')!);
    await userEvent.click(screen.getByRole('button', { name: 'حذف الخيار' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.arrayContaining([expect.objectContaining({ key: 'b' })]), { kind: 'delete', key: 'b' });
    expect(screen.getByTestId('selected')).toHaveTextContent('');
  });

  it('in manage mode, choosing an option opens its editor', async () => {
    render(<Host manage />);
    await userEvent.click(screen.getByRole('option', { name: /مكتمل/u }));
    expect(screen.getByRole('group', { name: 'خيارات مكتمل' })).toBeInTheDocument();
  });

  it('shows why nothing is listed', async () => {
    render(<CgOptionPicker options={[]} selected={[]} labels={labels} />);
    expect(screen.getByText('لا خيارات بعد')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('combobox', { name: 'ابحث' })).toBeInTheDocument();
  });
});

describe('CgItemPicker', () => {
  const people = [{ key: 'u1', label: 'ليلى حسن' }, { key: 'u2', label: 'سامي يوسف' }];
  function ItemHost({ multiple = true }: { multiple?: boolean }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string[]>(['u9']);
    const results = people.filter((person) => person.label.includes(query));
    return <><CgItemPicker
      items={results}
      selected={selected}
      multiple={multiple}
      onSelectionChange={setSelected}
      chip={(key) => ({ label: people.find((person) => person.key === key)?.label ?? 'عضو سابق' })}
      query={query}
      onQueryChange={setQuery}
      searchLabel="ابحث عن شخص"
      listLabel="الأشخاص"
      emptyText="لا أحد"
      removeLabel={(label) => `إزالة ${label}`}
      note="يظهر أول 20 فقط"
    /><output data-testid="chosen">{selected.join(',')}</output></>;
  }

  it('draws the caller\'s chips over the caller\'s results, and chooses with the keyboard', async () => {
    render(<ItemHost />);
    expect(screen.getByRole('button', { name: 'إزالة عضو سابق' })).toBeInTheDocument();
    expect(screen.getByText('يظهر أول 20 فقط')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'ابحث عن شخص' }));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('chosen')).toHaveTextContent('u9,u2');
    await userEvent.keyboard('سامي');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('xx');
    expect(screen.getByText('لا أحد')).toHaveAttribute('role', 'status');
    await userEvent.clear(screen.getByRole('combobox'));
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByTestId('chosen')).toHaveTextContent(/^u9$/u);
    await userEvent.click(screen.getByRole('button', { name: 'إزالة عضو سابق' }));
    expect(screen.getByTestId('chosen')).toHaveTextContent('');
  });
});
