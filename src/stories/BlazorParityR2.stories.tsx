import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../components/Button';
import { CgDropDownButton } from '../components/DropDownButton';
import type { CgButtonMenuItem } from '../components/DropDownButton';
import { CgSplitButton } from '../components/SplitButton';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Actions/Buttons: CgButtonMenuBase.cs, CgDropDownButton.razor, CgSplitButton.razor, CgButton.razor.cs, CgButtonMenus.md';
const difference = 'ToggleIconTemplate becomes toggleIcon, MenuCssClass becomes menuClassName and TrailingContent becomes trailingContent.';
const meta: Meta = { title: 'Blazor parity 2026-11/Button menus', parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const commands: ReadonlyArray<CgButtonMenuItem> = [
  { key: 'edit', text: 'Edit' },
  { key: 'export', text: 'Export', children: [{ key: 'pdf', text: 'PDF' }, { key: 'xlsx', text: 'Excel' }] },
  { key: 'archive', text: 'Archive', beginGroup: true },
];

export const IndicatorAndToggleIcons: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <style>{'.cg-story-tenant-menu { --cg-menu-accent: var(--cg-success); border-top: 3px solid var(--cg-success); }'}</style>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <CgDropDownButton items={commands}>Actions</CgDropDownButton>
      <CgDropDownButton items={commands} icon="settings" aria-label="Settings" title="Settings">{null}</CgDropDownButton>
      <CgDropDownButton items={commands} toggleIcon={<span style={{ fontSize: '0.7em' }}>▼</span>} appearance="outline">Custom glyph</CgDropDownButton>
      <CgDropDownButton items={commands} dropDownIndicatorVisible={false} aria-label="More commands" appearance="ghost">⋯</CgDropDownButton>
      <CgDropDownButton items={commands} menuClassName="cg-story-tenant-menu" appearance="soft">Tenant menu</CgDropDownButton>
      <CgSplitButton items={commands} toggleIcon={<span style={{ fontSize: '0.7em' }}>▼</span>} intent="primary">Save</CgSplitButton>
      <CgButton trailingContent={<span aria-hidden="true">→</span>} appearance="outline">Next step</CgButton>
    </div>
  </StoryFrame>,
};

export const IndicatorRtl: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div dir="rtl" style={{ display: 'flex', gap: 12 }}>
      <CgDropDownButton items={commands}>إجراءات</CgDropDownButton>
      <CgSplitButton items={commands} intent="primary" toggleAriaLabel="فتح القائمة">حفظ</CgSplitButton>
    </div>
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
