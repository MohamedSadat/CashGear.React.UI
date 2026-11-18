import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgTreeList, CgTreeListBrowserViewStore } from '../components/TreeList';
import type { CgTreeListColumn, CgTreeListParentKey } from '../components/TreeList';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Data/TreeList: CgTreeList.razor (layout tools), CgTreeList.Views.cs, CgTreeListViewStore.cs';
const difference = 'Blazor resolves ICgTreeListViewStore from DI; React takes namedViewStore and namedViewKey and reuses the Grid view manager popup.';
const meta: Meta = { title: 'Blazor parity 2026-11/TreeList layout and views', component: CgTreeList, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface Account { id: number; parent: number | null; code: string; name: string; balance: number }
const accounts: ReadonlyArray<Account> = [
  { id: 1, parent: null, code: '1000', name: 'Assets', balance: 1_250_000 },
  { id: 2, parent: 1, code: '1100', name: 'Cash and banks', balance: 310_000 },
  { id: 3, parent: 1, code: '1200', name: 'Receivables', balance: 940_000 },
  { id: 4, parent: null, code: '2000', name: 'Liabilities', balance: 720_000 },
];
const columns: ReadonlyArray<CgTreeListColumn<Account, number>> = [
  { type: 'text', fieldId: 'name', title: 'Account', hierarchy: true, getValue: (item) => item.name },
  { type: 'text', fieldId: 'code', title: 'Code', getValue: (item) => item.code },
  { type: 'number', fieldId: 'balance', title: 'Balance', getValue: (item) => item.balance },
];
const parentKey = (item: Account): CgTreeListParentKey<number> => item.parent === null ? { kind: 'none' } : { kind: 'key', key: item.parent };

function Accounts() {
  const store = useMemo(() => new CgTreeListBrowserViewStore<number>(), []);
  return <CgTreeList data={accounts} columns={columns} getKey={(item) => item.id} getParentKey={parentKey} defaultExpandedKeys={new Set([1])}
    showColumnManager namedViewStore={store} namedViewKey="story-accounts" height="22rem" />;
}

export const ColumnManagerAndNamedViews: Story = {
  render: () => <StoryFrame source={source} difference={difference}><Accounts /></StoryFrame>,
};
