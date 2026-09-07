# CgPdfViewer

`CgPdfViewer` renders PDF documents in the browser with the checked-in `pdfjs-dist` 6.2.108 runtime. It supports URL, in-memory, and authorized provider sources; navigation, zoom, rotation, search, thumbnails, outlines, password prompts, print, download, fullscreen, lifecycle callbacks, and replaceable UI regions.

```tsx
import '@cashgear/ui/styles.css';
import { CgPdfViewer } from '@cashgear/ui';

<CgPdfViewer
  source={{ kind: 'url', url: '/api/invoices/1042/pdf', fileName: 'invoice-1042.pdf' }}
  height="42rem"
  ariaLabel="Invoice 1042"
/>
```

## Deploying the runtime assets

The package includes the runtime at `dist/vendor/pdfjs`. Copy that directory without changing its contents to your application's public `/cashgear-ui/pdfjs/` directory. The component resolves the main module, worker, viewer CSS/images, CMaps, standard fonts, ICC profiles, and codecs from that base. If the host deploys it elsewhere, pass a same-origin or CORS-enabled `assetBaseUrl` ending in `/`.

Storybook performs this copy through its `staticDirs` configuration. The library build also emits the directory unchanged and package verification checks every file against the committed integrity manifest.

## Sources and cancellation

```tsx
const source = {
  kind: 'provider' as const,
  fileName: 'invoice.pdf',
  load: ({ signal, requestId }) => fetch(`/api/invoices/current/pdf?request=${requestId}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  }),
};
```

Providers receive a generation-specific `AbortSignal`. A replacement source or unmount aborts stale work, and late results cannot replace the current document. Provider `Response`, `Blob`, `ArrayBuffer`, and `Uint8Array` values are accepted and copied before they cross into PDF.js. `maximumDocumentBytes` defaults to 100 MiB and `maximumPageCount` defaults to 2,000.

## Security boundary

External links and AcroForm controls are disabled by default. Enable them independently with `allowExternalLinks` and `allowFormFields`; external navigation still passes through cancellable `onExternalLinkOpening`. Only HTTP, HTTPS, mail, and telephone annotation links are eligible. Document URLs accept HTTP(S) only. JavaScript PDF actions, XFA, dynamic evaluation, and the PDF.js scripting sandbox are disabled or excluded from the package.

These client checks are not authorization. Provider callbacks and URL endpoints must enforce tenant/document access, and sensitive PDFs should use appropriate cache headers. Passwords are passed directly to PDF.js and are not included in lifecycle events or retained after submission.

## Controlled state and actions

`source`, `currentPage`, `zoom`, `zoomMode`, `rotation`, `sidebarMode`, and `searchText` support controlled/default pairs. Controlled values remain authoritative after viewer-originated proposals. `actionsRef` exposes loading/reloading, page navigation, zoom and rotation, search, print/download/fullscreen, and metadata inspection. Every async action returns a typed status instead of throwing expected availability, rejection, cancellation, or document failures.

The default toolbar, loading, empty, error, password, and page-overlay regions can be replaced with render callbacks. Labels are replaceable for localization; `direction="rtl"` uses logical layout while page content keeps its authored direction.
