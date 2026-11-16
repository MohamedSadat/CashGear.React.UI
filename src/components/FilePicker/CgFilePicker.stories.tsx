import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgFilePicker } from './CgFilePicker';

const source = 'None: React only (Cash Gear Workspace Track U16, the import dialog\'s file input)';
const difference = 'Gives the chosen or dropped files and nothing else; CgFileUploader is the control that uploads.';
const meta = { title: 'Phase 37/FilePicker', component: CgFilePicker, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgFilePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

function Fixture({ dropZone }: { dropZone: boolean }) {
  const [picked, setPicked] = useState('لم يُختر ملف');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 12, inlineSize: 'min(32rem, 100%)' }} data-testid="file-picker-demo">
      <CgFilePicker
        accept={['.csv', '.tsv', '.txt', 'text/csv', 'text/tab-separated-values', 'text/plain']}
        appearance="outline"
        icon="upload"
        dropZone={dropZone}
        hint={dropZone ? 'أو أفلت ملف CSV هنا' : undefined}
        onPick={(files, details) => setPicked(`${details.source === 'drop' ? 'أُفلت' : 'اختير'}: ${files.map((file) => file.name).join('، ')}`)}
        onReject={(files) => setPicked(`رُفض: ${files.map((file) => file.name).join('، ')}`)}
      >اختر ملفاً</CgFilePicker>
      <output data-testid="picked">{picked}</output>
    </div>
  </StoryFrame>;
}

export const Button: Story = { args: { children: 'اختر ملفاً', onPick: () => undefined }, render: () => <Fixture dropZone={false} />, globals: { direction: 'rtl' } };
export const DropZone: Story = { args: { children: 'اختر ملفاً', onPick: () => undefined }, render: () => <Fixture dropZone />, globals: { direction: 'rtl' } };
export const DropZoneDark: Story = { args: { children: 'اختر ملفاً', onPick: () => undefined }, render: () => <Fixture dropZone />, globals: { theme: 'dark', direction: 'rtl' } };
export const Disabled: Story = { args: { children: 'اختر ملفاً', onPick: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><CgFilePicker disabled dropZone appearance="outline" hint="الاستيراد جارٍ" onPick={() => undefined}>اختر ملفاً</CgFilePicker></StoryFrame>, globals: { direction: 'rtl' } };
