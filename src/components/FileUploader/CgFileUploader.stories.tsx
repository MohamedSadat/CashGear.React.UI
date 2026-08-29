import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgField } from '../Field';
import { CgFileUploader } from './CgFileUploader';
import { saveSession } from './endpointTransport';
import type { CgFileUploadResult, CgStoredFile } from './CgFileUploader.types';

const source = 'CashGear.Blazor.UI@6fc1e4577fbb2a492150f991945c478fac8a917f: Components/Editors/CgFileUploader.* and CgFileUpload*';
const difference = 'React owns immutable File snapshots, uses AbortSignal handlers or the v2 fetch/XHR endpoint protocol, and submits only durable stored-file IDs through native forms.';
const meta: Meta = { title: 'Phase 17/FileUploader', component: CgFileUploader, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const stored = (id: string, name: string, size = 128_000): CgStoredFile => ({
  id, location: `/attachments/${id}`, name, size, contentType: name.endsWith('.pdf') ? 'application/pdf' : 'text/csv', metadata: {},
});

const successfulUpload = async ({ file, reportProgress, signal }: { file: File; reportProgress: (value: number) => void; signal: AbortSignal }): Promise<CgFileUploadResult> => {
  reportProgress(35);
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 180);
    signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
  });
  reportProgress(100);
  return { succeeded: true, storedFile: stored(`stored-${file.name}`, file.name, file.size) };
};

function Frame({ children }: { children: React.ReactNode }) {
  return <StoryFrame source={source} difference={difference}><div style={{ inlineSize: 'min(42rem, 100%)' }}>{children}</div></StoryFrame>;
}

function RetryExample() {
  const attempts = useRef(new Map<string, number>());
  return <CgField label="Invoice attachments" description="The first upload fails; retry stores the durable file.">
    <CgFileUploader autoUpload upload={({ file }) => {
      const attempt = (attempts.current.get(file.name) ?? 0) + 1;
      attempts.current.set(file.name, attempt);
      return attempt === 1 ? { succeeded: false, errorMessage: 'Virus scanner is temporarily unavailable.' } : { succeeded: true, storedFile: stored(`retry-${file.name}`, file.name, file.size) };
    }} allowedExtensions={['pdf']} />
  </CgField>;
}

function NativeFormExample() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return <form onSubmit={(event) => {
    event.preventDefault();
    setSubmitted(new FormData(event.currentTarget).getAll('attachment').map((value) => typeof value === 'string' ? value : value.name).join(', ') || 'No durable files');
  }}>
    <CgField label="Required supporting files" required description="Only successful durable IDs are submitted.">
      <CgFileUploader name="attachment" required validationMode="require-all-succeeded" upload={successfulUpload} defaultStoredFiles={[stored('invoice-2026', 'invoice-2026.pdf')]} />
    </CgField>
    <div style={{ display: 'flex', gap: 8, marginBlockStart: 12 }}><button type="submit">Submit attachments</button><button type="reset">Reset attachments</button></div>
    <output aria-label="Submitted attachment IDs" style={{ display: 'block', marginBlockStart: 8 }}>{submitted}</output>
  </form>;
}

function MultipleProgressExample() {
  return <CgField label="Batch documents" description="Two files upload concurrently with size-weighted aggregate progress.">
    <CgFileUploader maxConcurrentUploads={2} upload={({ file, signal, reportProgress }) => {
      reportProgress(file.name.startsWith('large') ? 62 : 28);
      return new Promise<CgFileUploadResult>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
      });
    }} />
  </CgField>;
}

function RecoveredExample() {
  useState(() => {
    saveSession('phase17-story-recovery', {
      itemId: 'recovered-ledger', endpoint: '/_cg-story-upload', uploadId: 'upload-recovered', sessionToken: 'story-private-token',
      name: 'ledger-august.csv', size: 400_000, contentType: 'text/csv', lastModified: new Date('2026-08-28T10:00:00Z').toISOString(),
      fingerprint: '8aef-story-fingerprint', metadata: { module: 'ledger' }, chunkSize: 100_000, chunkCount: 4, receivedChunks: [0, 1],
      expiresAtUtc: new Date('2099-01-01T00:00:00Z').toISOString(),
    });
    return true;
  });
  return <CgField label="Recovered resumable upload" description="Resumption requires reselecting the exact browser file.">
    <CgFileUploader uploadEndpoint="/_cg-story-upload" persistenceKey="phase17-story-recovery" autoUpload={false} />
  </CgField>;
}

const arabicLabels = {
  dropZone: 'اسحب الملفات هنا أو اضغط للاختيار', dropZoneAriaLabel: 'اختيار ملفات للرفع', browse: 'اختيار',
  hint: 'حتى {count} ملفات، {size} لكل ملف.', fileList: 'الملفات المختارة', succeeded: 'تم الرفع', remove: 'إزالة',
  clear: 'مسح', removeFile: 'إزالة {name}', empty: 'لم يتم اختيار ملفات',
};

export const BasicAutomatic: Story = { render: () => <Frame><CgField label="Receipts" description="PDF or image files upload immediately after selection."><CgFileUploader upload={successfulUpload} allowedExtensions={['pdf', 'png', 'jpg']} /></CgField></Frame> };
export const ManualUpload: Story = { render: () => <Frame><CgField label="Payment evidence"><CgFileUploader upload={successfulUpload} autoUpload={false} defaultStoredFiles={[stored('bank-letter', 'bank-letter.pdf')]} /></CgField></Frame> };
export const MultipleProgress: Story = { render: () => <Frame><MultipleProgressExample /></Frame> };
export const ValidationAndFailure: Story = { render: () => <Frame><CgField label="Validated invoices" required><CgFileUploader upload={() => ({ succeeded: false, errorMessage: 'The storage service rejected this file.' })} allowedExtensions={['pdf']} maxFileSize={256_000} maxFileCount={2} required validationMode="require-all-succeeded" /></CgField></Frame> };
export const FailedRetry: Story = { render: () => <Frame><RetryExample /></Frame> };
export const EndpointResumable: Story = { render: () => <Frame><CgField label="Resumable endpoint upload"><CgFileUploader uploadEndpoint="/_cg-story-upload" persistenceKey="phase17-endpoint-story" maxChunkRetries={1} /></CgField></Frame> };
export const PausedRecovery: Story = { render: () => <Frame><RecoveredExample /></Frame> };
export const NativeForm: Story = { render: () => <Frame><NativeFormExample /></Frame> };
export const DisabledAndReadOnly: Story = { render: () => <Frame><div style={{ display: 'grid', gap: 20 }}><CgField label="Disabled uploader" disabled><CgFileUploader disabled name="disabledAttachment" upload={successfulUpload} defaultStoredFiles={[stored('disabled-file', 'locked-invoice.pdf')]} /></CgField><CgField label="Read-only uploader" readOnly><CgFileUploader readOnly name="readonlyAttachment" upload={successfulUpload} defaultStoredFiles={[stored('readonly-file', 'approved-invoice.pdf')]} /></CgField></div></Frame> };
export const CustomRendering: Story = { render: () => <Frame><CgFileUploader upload={successfulUpload} defaultStoredFiles={[stored('custom-file', 'custom-ledger.csv')]} renderDropZone={() => <div style={{ padding: 20, textAlign: 'center' }}><strong>Drop a ledger export</strong><br /><small>Custom drop-zone content</small></div>} renderFile={({ item, actions }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><code>{item.name}</code><button type="button" onClick={() => { void actions.remove(item.id); }}>Forget</button></div>} /></Frame> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <Frame><CgField label="Compact evidence"><CgFileUploader density="compact" size="small" upload={successfulUpload} defaultStoredFiles={[stored('dark-1', 'invoice.pdf'), stored('dark-2', 'receipt.png', 86_000)]} /></CgField></Frame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <Frame><div dir="rtl"><CgField label="المرفقات"><CgFileUploader direction="rtl" upload={successfulUpload} labels={arabicLabels} defaultStoredFiles={[stored('arabic-1', 'فاتورة-أغسطس.pdf')]} /></CgField></div></Frame> };
export const NarrowLayout: Story = { render: () => <Frame><div style={{ inlineSize: 292 }}><CgField label="Narrow attachment panel"><CgFileUploader upload={successfulUpload} autoUpload={false} defaultStoredFiles={[stored('narrow-1', 'long-quarterly-financial-statement.pdf')]} /></CgField></div></Frame> };
export const ReducedMotion: Story = { render: () => <Frame><CgFileUploader upload={successfulUpload} defaultStoredFiles={[stored('motion-1', 'motion-safe.pdf')]} /></Frame> };
