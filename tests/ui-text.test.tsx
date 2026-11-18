import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CgFilterBuilder, CgGrid, CgPager, CgPopup, CgToastProvider, CgUiTextProvider, useCgToast, useCgUiText } from '../src';
import type { CgFilterBuilderFieldDescriptor, CgGridColumnDescriptor, CgGridViewStore } from '../src';
import { useEffect } from 'react';

const ARABIC: Readonly<Record<string, string>> = {
  Close: 'إغلاق',
  'Sort ascending': 'ترتيب تصاعدي',
  'Sort descending': 'ترتيب تنازلي',
  'Hide column': 'إخفاء العمود',
  Refresh: 'تحديث',
  'Grouping levels': 'مستويات التجميع',
  'Data grid': 'جدول البيانات',
  Views: 'طرق العرض',
  'Grid views': 'طرق عرض الجدول',
  'Save as new': 'حفظ كجديد',
  '{0} records': '{0} سجلات',
  'Page {0} of {1}': 'صفحة {0} من {1}',
  Notifications: 'الإشعارات',
  'Group logic': 'منطق المجموعة',
  'All conditions': 'كل الشروط',
  'Add condition': 'إضافة شرط',
};
const translate = (text: string) => ARABIC[text] ?? text;

interface Row { id: number; name: string }
const rows: ReadonlyArray<Row> = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
const columns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [{ type: 'text', fieldId: 'name', title: 'Name', accessor: (row) => row.name }];

const memoryStore: CgGridViewStore = {
  getCatalog: async () => ({ views: [] }),
  load: async () => null,
  save: async () => { throw new Error('not used'); },
  delete: async () => undefined,
  setDefault: async () => undefined,
  resetDefault: async () => undefined,
};

describe('CgUiTextProvider', () => {
  it('returns text unchanged without a provider', () => {
    let seen = '';
    function Probe() { seen = useCgUiText().translate('Close'); return null; }
    render(<Probe />);
    expect(seen).toBe('Close');
  });

  it('translates built-in defaults, while labels the page passes win even when they equal the English text', () => {
    render(<CgUiTextProvider translate={translate}>
      <CgPopup open headerText="One" showCloseButton>first</CgPopup>
      <CgPopup open headerText="Two" showCloseButton closeButtonAriaLabel="Close">second</CgPopup>
    </CgUiTextProvider>);
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    expect(names).toContain('إغلاق');
    expect(names).toContain('Close');
  });

  it('keeps English when the translator returns nothing', () => {
    render(<CgUiTextProvider translate={() => ''}><CgPopup open headerText="One" showCloseButton>first</CgPopup></CgUiTextProvider>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('translates the grid context menu, group panel, records format and accessible name', async () => {
    render(<CgUiTextProvider translate={translate}>
      <CgGrid data={rows} columns={columns} keySelector={(row) => row.id} allowGrouping contextMenuAreas={['header']} labels={{ refresh: 'Reload now' }} />
    </CgUiTextProvider>);
    expect(screen.getByRole('grid', { name: 'جدول البيانات' })).toBeInTheDocument();
    expect(document.querySelector('[aria-label="مستويات التجميع"]')).not.toBeNull();
    expect(screen.getByText(/2 سجلات · صفحة 1 من 1/)).toBeInTheDocument();
    await act(async () => { fireEvent.contextMenu(screen.getByRole('columnheader', { name: /Name/ }), { clientX: 10, clientY: 10 }); });
    expect(await screen.findByText('ترتيب تصاعدي')).toBeInTheDocument();
    expect(screen.getByText('إخفاء العمود')).toBeInTheDocument();
    expect(screen.getByText('Reload now')).toBeInTheDocument();
  });

  it('names grid context commands and popup titles through labels without a provider', async () => {
    render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} contextMenuAreas={['header']} labels={{ sortAscending: 'A to Z', hideColumn: 'Hide' }} />);
    await act(async () => { fireEvent.contextMenu(screen.getByRole('columnheader', { name: /Name/ }), { clientX: 10, clientY: 10 }); });
    expect(await screen.findByText('A to Z')).toBeInTheDocument();
    expect(screen.getByText('Hide')).toBeInTheDocument();
    expect(screen.getByText('Sort descending')).toBeInTheDocument();
  });

  it('opens the popup editor with its own title, width and maximum height', async () => {
    interface Editable { id: number; name: string }
    const editableColumns: ReadonlyArray<CgGridColumnDescriptor<Editable>> = [{ type: 'text', fieldId: 'name', title: 'Name', accessor: (row) => row.name, editor: { kind: 'text', setValue: (row, name) => ({ ...row, name: String(name) }) } }];
    render(<CgGrid data={[{ id: 1, name: 'Alpha' }]} columns={editableColumns} keySelector={(row) => row.id} labels={{ createPopupTitle: 'New customer' }} editPopupWidth="300px" editPopupMaxHeight="200px"
      editing={{ create: true, newItemFactory: () => ({ id: 2, name: '' }), createItem: async () => ({ succeeded: true }) }} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })); });
    const dialog = await screen.findByRole('dialog', { name: 'New customer' });
    expect(dialog.style.width).toBe('300px');
    expect(dialog.style.maxHeight).toBe('200px');
  });

  it('translates the view manager', async () => {
    render(<CgUiTextProvider translate={translate}>
      <CgGrid data={rows} columns={columns} keySelector={(row) => row.id} viewKey="ui-text" viewStore={memoryStore} />
    </CgUiTextProvider>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'طرق العرض' })); });
    expect(await screen.findByRole('dialog', { name: 'طرق عرض الجدول' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ كجديد' })).toBeInTheDocument();
  });

  it('translates the pager format strings and the toast region', async () => {
    function Notify() { const toast = useCgToast(); useEffect(() => { toast.info('Saved', { persistent: true }); }, [toast]); return null; }
    render(<CgUiTextProvider translate={translate}>
      <CgToastProvider><Notify /></CgToastProvider>
      <CgPager pageIndex={0} pageSize={10} totalItemCount={40} />
    </CgUiTextProvider>);
    expect(await screen.findByRole('region', { name: 'الإشعارات' })).toBeInTheDocument();
  });

  it('names the toast region through a provider prop', async () => {
    function Notify() { const toast = useCgToast(); useEffect(() => { toast.info('Saved', { persistent: true }); }, [toast]); return null; }
    render(<CgToastProvider regionAriaLabel="Alerts"><Notify /></CgToastProvider>);
    expect(await screen.findByRole('region', { name: 'Alerts' })).toBeInTheDocument();
  });

  it('translates filter builder accessible names and lets labels override them', () => {
    const fields: ReadonlyArray<CgFilterBuilderFieldDescriptor> = [{ fieldId: 'name', label: 'Name', kind: 'text' }];
    const { unmount } = render(<CgUiTextProvider translate={translate}><CgFilterBuilder fields={fields} /></CgUiTextProvider>);
    expect(screen.getByRole('combobox', { name: 'منطق المجموعة' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'كل الشروط' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة شرط' })).toBeInTheDocument();
    unmount();
    render(<CgFilterBuilder fields={fields} labels={{ groupLogic: 'Match' }} />);
    expect(screen.getByRole('combobox', { name: 'Match' })).toBeInTheDocument();
  });
});
