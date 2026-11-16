import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgMenuPanel, CgMenuPanelGroup, CgMenuPanelHeader, CgMenuPanelItem, CgMenuPanelSeparator, CgMenuPanelSwitch } from './CgMenuPanel';

function Fixture({ onSelect = vi.fn(), onToggle = vi.fn(), onEscape, onBack }: { onSelect?: () => void; onToggle?: (checked: boolean) => void; onEscape?: () => void; onBack?: () => void }) {
  return <CgMenuPanel
    label="خصائص العمود"
    onEscape={onEscape}
    header={<CgMenuPanelHeader title="العمود" onBack={onBack} backLabel="رجوع" />}
    fields={<input aria-label="اسم العمود" defaultValue="الكمية" />}
  >
    <CgMenuPanelItem icon="number-format" hint="رقم" opensPanel onSelect={onSelect}>تغيير النوع</CgMenuPanelItem>
    <CgMenuPanelSwitch checked={false} onCheckedChange={onToggle}>إظهار في العرض</CgMenuPanelSwitch>
    <CgMenuPanelGroup label="الترتيب">
      <CgMenuPanelItem checked onSelect={onSelect}>تصاعدي</CgMenuPanelItem>
      <CgMenuPanelItem checked={false} onSelect={onSelect}>تنازلي</CgMenuPanelItem>
    </CgMenuPanelGroup>
    <CgMenuPanelSeparator />
    <CgMenuPanelItem icon="delete" danger disabled onSelect={onSelect}>حذف</CgMenuPanelItem>
  </CgMenuPanel>;
}

describe('CgMenuPanel', () => {
  it('holds fields above a named menu of items, switches, groups and a separator', () => {
    render(<Fixture onBack={() => undefined} />);
    const menu = screen.getByRole('menu', { name: 'خصائص العمود' });
    expect(screen.getByRole('textbox', { name: 'اسم العمود' })).not.toBeNull();
    expect(menu.contains(screen.getByRole('textbox'))).toBe(false);
    expect(screen.getByRole('menuitem', { name: /تغيير النوع/u })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getByRole('menuitemcheckbox', { name: 'إظهار في العرض' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemradio', { name: 'تصاعدي' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('group', { name: 'الترتيب' })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'حذف' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'رجوع' })).toBeInTheDocument();
  });

  it('moves focus with the arrows, Home and End, between the field and the items, skipping disabled ones', async () => {
    render(<Fixture />);
    const field = screen.getByRole('textbox', { name: 'اسم العمود' });
    act(() => field.focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /تغيير النوع/u })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: /تغيير النوع/u })).toHaveAttribute('tabindex', '0');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox')).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: /تغيير النوع/u })).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitemradio', { name: 'تنازلي' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /تغيير النوع/u })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(field).toHaveFocus();
  });

  it('activates items and toggles switches with Enter and Space', async () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    render(<Fixture onSelect={onSelect} onToggle={onToggle} />);
    act(() => screen.getByRole('menuitem', { name: /تغيير النوع/u }).focus());
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowDown}{ }');
    expect(onToggle).toHaveBeenCalledWith(true, expect.anything());
  });

  it('reports Escape and the back button', () => {
    const onEscape = vi.fn();
    const onBack = vi.fn();
    render(<Fixture onEscape={onEscape} onBack={onBack} />);
    fireEvent.keyDown(screen.getByRole('menuitemcheckbox'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('needs a menu label, and a back label with onBack', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgMenuPanel label="">x</CgMenuPanel>)).toThrow(/label/u);
    expect(() => render(<CgMenuPanelHeader title="x" onBack={() => undefined} />)).toThrow(/backLabel/u);
  });
});
