import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgPdfViewer } from './CgPdfViewer';
import type { CgPdfViewerActions } from './CgPdfViewer.types';

const source = 'CashGear.Blazor.UI/Components/Documents/PdfViewer/* @ 32edd96e';
const difference = 'React uses a typed URL/data/provider source union, AbortSignal generations, render callbacks, and an actions ref around the same pinned local PDF.js runtime.';
const meta: Meta = { title: 'Phase 25/PdfViewer', component: CgPdfViewer, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const handbook = { kind: 'url', url: '/pdf-samples/cashgear-handbook.pdf', fileName: 'cashgear-handbook.pdf' } as const;
const invoice = { kind: 'url', url: '/pdf-samples/cashgear-invoice.pdf', fileName: 'cashgear-invoice.pdf' } as const;
const protectedDocument = { kind: 'url', url: '/pdf-samples/cashgear-protected.pdf', fileName: 'cashgear-protected.pdf' } as const;
const invalidDocument = { kind: 'data', data: new TextEncoder().encode('This is not a PDF'), fileName: 'invalid.pdf' } as const;

function InteractiveViewer({ dark = false }: { dark?: boolean }) {
  const actions = useRef<CgPdfViewerActions>(null);
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState('Waiting for the document');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ width: 'min(900px, calc(100vw - 40px))' }} data-story-variant={dark ? 'dark' : 'light'}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <CgButton appearance="outline" data-testid="pdf-go-page-24" onClick={async () => { await actions.current?.goToPage(24); }}>Go to page 24</CgButton>
        <CgButton appearance="outline" onClick={async () => { await actions.current?.find('warehouse reconciliation'); }}>Find warehouse</CgButton>
        <output aria-label="PDF story page">Page {page}</output>
        <output aria-label="PDF story event">{event}</output>
      </div>
      <CgPdfViewer
        actionsRef={actions}
        defaultSource={handbook}
        defaultSidebarMode="thumbnails"
        height="42rem"
        ariaLabel="CashGear operations handbook"
        data-testid="pdf-primary"
        onDocumentLoaded={({ documentInfo }) => setEvent(`Loaded ${documentInfo.pageCount} pages`)}
        onCurrentPageChange={(nextPage, details) => { setPage(nextPage); setEvent(`Page ${nextPage} (${details.reason})`); }}
        onSearchComplete={({ resultIndex, resultCount }) => setEvent(`Search ${resultIndex}/${resultCount}`)}
        renderPageOverlay={({ pageNumber, pageCount }) => <output className="cg-pdf-story__page-pill" data-testid="pdf-page-overlay">Page {pageNumber} / {pageCount}</output>}
      />
    </div>
  </StoryFrame>;
}

function SecurityComparison() {
  const [policy, setPolicy] = useState('No external link has been requested.');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, width: 'min(980px, calc(100vw - 40px))' }}>
      <article><h3>Default: inert annotations</h3><CgPdfViewer source={invoice} height="25rem" showToolbar={false} showSidebar={false} ariaLabel="Invoice with default security settings" data-testid="pdf-secure-default" /></article>
      <article><h3>Opt-in: links and forms</h3><CgPdfViewer source={invoice} height="25rem" showToolbar={false} showSidebar={false} allowExternalLinks allowFormFields ariaLabel="Invoice with links and forms enabled" data-testid="pdf-security-opt-in" onExternalLinkOpening={({ url }) => { setPolicy(`Host canceled navigation to ${new URL(url).host}.`); return false; }} /></article>
      <output aria-label="PDF link policy" style={{ gridColumn: '1 / -1' }}>{policy}</output>
    </div>
  </StoryFrame>;
}

export const Interactive: Story = { render: () => <InteractiveViewer /> };
export const PasswordProtected: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 'min(760px, calc(100vw - 40px))' }}><p>Password: <code>cashgear-demo</code></p><CgPdfViewer source={protectedDocument} height="32rem" ariaLabel="Password-protected CashGear document" data-testid="pdf-protected" /></div></StoryFrame> };
export const SecurityDefaultsAndOptIn: Story = { render: () => <SecurityComparison /> };
export const ProviderSource: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 760, maxWidth: 'calc(100vw - 40px)' }}><CgPdfViewer source={{ kind: 'provider', fileName: 'authorized-handbook.pdf', load: async ({ signal }) => fetch(handbook.url, { signal }) }} height="34rem" ariaLabel="Authorized provider PDF" /></div></StoryFrame> };
export const StatesAndTemplates: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 14, width: 720, maxWidth: 'calc(100vw - 40px)' }}><CgPdfViewer height="11rem" ariaLabel="Empty PDF template" renderToolbar={() => <nav aria-label="Custom PDF commands"><strong>Review evidence</strong></nav>} renderEmpty={() => <p>No evidence document is attached to this record.</p>} /><CgPdfViewer source={invalidDocument} height="11rem" showToolbar={false} showSidebar={false} ariaLabel="Invalid PDF state" renderError={({ error }) => <div style={{ display: 'grid', gap: 4 }}><strong>{error.code}</strong><span>{error.message}</span></div>} /><CgPdfViewer height="11rem" disabled ariaLabel="Disabled PDF viewer" /></div></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <InteractiveViewer dark /> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference} noteDirection="ltr"><div dir="rtl" style={{ width: 'min(760px, calc(100vw - 40px))' }}><CgPdfViewer source={invoice} direction="rtl" height="32rem" ariaLabel="عارض فاتورة كاش جير" labels={{ toolbarAriaLabel: 'شريط أدوات ملف PDF', previousPage: 'الصفحة السابقة', nextPage: 'الصفحة التالية', page: 'صفحة', of: 'من', search: 'بحث في المستند', download: 'تنزيل', print: 'طباعة' }} /></div></StoryFrame> };
export const Narrow: Story = { render: () => <div style={{ width: 350 }}><StoryFrame source={source} difference={difference}><CgPdfViewer source={invoice} height="34rem" ariaLabel="Narrow invoice viewer" /></StoryFrame></div> };
