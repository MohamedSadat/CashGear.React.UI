/* eslint-disable @typescript-eslint/unbound-method -- controller methods are Vitest spies in this adapter contract test. */
import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CgPdfViewer } from '../src/components/PdfViewer';
import type { CgPdfDocumentInfo, CgPdfDocumentSource, CgPdfViewerActions } from '../src/components/PdfViewer';
import type { PdfController, PdfControllerBridge, PdfLoadOptions } from '../src/components/PdfViewer/pdfController.js';

const pdfModule = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../src/components/PdfViewer/pdfController.js', () => ({ create: pdfModule.create }));

const info: CgPdfDocumentInfo = Object.freeze({
  pageCount: 3,
  sizeBytes: 128,
  pdfFormatVersion: '1.7',
  title: 'CashGear handbook',
  author: null,
  subject: null,
  keywords: null,
  creator: null,
  producer: null,
  language: 'en',
  creationDate: null,
  modifiedDate: null,
  isEncrypted: false,
  hasOutline: true,
  hasForms: false,
});

let bridge: PdfControllerBridge;
let controller: PdfController;
let generation = 0;

function controllerMock(): PdfController {
  return {
    clear: vi.fn(async (nextGeneration: number) => { generation = nextGeneration; return true; }),
    loadUrl: vi.fn(async (_url: string, nextGeneration: number) => { generation = nextGeneration; return { succeeded: true, canceled: false, documentInfo: info }; }),
    loadStream: vi.fn(async (_stream: { arrayBuffer(): Promise<ArrayBuffer> }, nextGeneration: number) => { generation = nextGeneration; return { succeeded: true, canceled: false, documentInfo: info }; }),
    goToPage: vi.fn(async (page: number, reason = 'Navigation') => { await bridge.invokeMethodAsync('OnPageChangedAsync', generation, page, reason); return true; }),
    setZoom: vi.fn(async (zoom: number, reason = 'Command') => { await bridge.invokeMethodAsync('OnZoomChangedAsync', generation, zoom, 'Custom', reason); return true; }),
    setZoomMode: vi.fn(async (_mode: string) => true),
    setRotation: vi.fn(async () => true),
    find: vi.fn(async (text: string) => { await bridge.invokeMethodAsync('OnSearchCompletedAsync', generation, text, 2, 4); return true; }),
    clearSearch: vi.fn(async () => true),
    setSidebarMode: vi.fn(async () => undefined),
    submitPassword: vi.fn(async () => true),
    cancelPassword: vi.fn(async () => true),
    download: vi.fn(async () => true),
    print: vi.fn(async () => true),
    enterFullscreen: vi.fn(async () => true),
    exitFullscreen: vi.fn(async () => true),
    dispose: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  generation = 0;
  controller = controllerMock();
  pdfModule.create.mockReset().mockImplementation(async (...args: unknown[]) => {
    bridge = args[4] as PdfControllerBridge;
    return controller;
  });
});

describe('CgPdfViewer', () => {
  it('renders an accessible empty state and initializes the packaged asset contract', async () => {
    const { container } = render(<CgPdfViewer />);
    expect(screen.getByText('No PDF document selected.')).toBeVisible();
    await waitFor(() => expect(pdfModule.create).toHaveBeenCalledOnce());
    const options = pdfModule.create.mock.calls[0]![5] as PdfLoadOptions & { assetBaseUrl: string };
    expect(options.assetBaseUrl).toBe('/cashgear-ui/pdfjs/');
    expect(container.querySelector('section')).toHaveAttribute('aria-label', 'PDF viewer');
  });

  it('loads URL sources, publishes metadata, and navigates through toolbar actions', async () => {
    const loaded = vi.fn();
    const pageChanged = vi.fn();
    render(<CgPdfViewer defaultSource={{ kind: 'url', url: '/pdf-samples/cashgear-handbook.pdf' }} onDocumentLoaded={loaded} onCurrentPageChange={pageChanged} />);
    await waitFor(() => expect(loaded).toHaveBeenCalledOnce());
    expect(controller.clear).toHaveBeenCalledWith(1);
    expect(controller.loadUrl).toHaveBeenCalledWith('/pdf-samples/cashgear-handbook.pdf', 1, expect.objectContaining({ maximumPages: 2000, zoomMode: 'FitWidth' }));
    expect(screen.getByLabelText('Page')).toHaveValue('1');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Next page' })); });
    expect(controller.goToPage).toHaveBeenCalledWith(2);
    expect(pageChanged).toHaveBeenCalledWith(2, expect.objectContaining({ previousPage: 1, reason: 'navigation' }));
    expect(screen.getByLabelText('Page')).toHaveValue('2');
  });

  it('loads provider data, cancels stale providers, and ignores their completion', async () => {
    let releaseFirst!: (value: Uint8Array) => void;
    let firstSignal!: AbortSignal;
    const first: CgPdfDocumentSource = { kind: 'provider', load: ({ signal }) => { firstSignal = signal; return new Promise((resolve) => { releaseFirst = resolve; }); } };
    const second: CgPdfDocumentSource = { kind: 'provider', load: () => new Uint8Array([37, 80, 68, 70, 45]) };
    const loaded = vi.fn();
    const view = render(<CgPdfViewer source={first} onDocumentLoaded={loaded} />);
    await waitFor(() => expect(firstSignal).toBeDefined());

    view.rerender(<CgPdfViewer source={second} onDocumentLoaded={loaded} />);
    await waitFor(() => expect(firstSignal.aborted).toBe(true));
    await waitFor(() => expect(loaded).toHaveBeenCalledOnce());
    releaseFirst(new Uint8Array([37, 80, 68, 70, 45]));
    await act(async () => { await Promise.resolve(); });
    expect(controller.loadStream).toHaveBeenCalledOnce();
  });

  it('returns current search counts from the imperative result', async () => {
    const actions = createRef<CgPdfViewerActions>();
    render(<CgPdfViewer defaultSource={{ kind: 'data', data: new Uint8Array([37, 80, 68, 70, 45]) }} actionsRef={actions} />);
    await waitFor(() => expect(actions.current?.getDocumentInfo().succeeded).toBe(true));
    const result = await act(async () => actions.current!.find('invoice'));
    expect(result).toMatchObject({ succeeded: true, searchText: 'invoice', resultIndex: 2, resultCount: 4 });
  });

  it('keeps controlled page state authoritative and labels the correction as binding', async () => {
    const changed = vi.fn();
    render(<CgPdfViewer source={{ kind: 'url', url: '/document.pdf' }} currentPage={1} onCurrentPageChange={changed} />);
    await waitFor(() => expect(controller.loadUrl).toHaveBeenCalledOnce());
    await act(async () => { await bridge.invokeMethodAsync('OnPageChangedAsync', generation, 3, 'Scroll'); });
    expect(screen.getByLabelText('Page')).toHaveValue('1');
    expect(changed).toHaveBeenCalledWith(3, expect.objectContaining({ reason: 'scroll' }));
    expect(controller.goToPage).toHaveBeenCalledWith(1, 'Binding');
  });

  it('exposes password recovery without leaking the password into callbacks', async () => {
    const requested = vi.fn();
    render(<CgPdfViewer source={{ kind: 'url', url: '/protected.pdf' }} onPasswordRequested={requested} />);
    await waitFor(() => expect(controller.loadUrl).toHaveBeenCalledOnce());
    await act(async () => { await bridge.invokeMethodAsync('OnPasswordRequestedAsync', generation, 'Required'); });
    const input = screen.getByLabelText('Password');
    fireEvent.change(input, { target: { value: 'secret' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open document' })); });
    expect(controller.submitPassword).toHaveBeenCalledWith('secret');
    expect(requested).toHaveBeenCalledWith(expect.objectContaining({ reason: 'required', attempt: 1 }));
    expect(requested.mock.calls[0]![0]).not.toHaveProperty('password');
  });

  it('blocks external links by default and lets opted-in consumers veto them', async () => {
    const veto = vi.fn(() => false);
    const view = render(<CgPdfViewer source={{ kind: 'url', url: '/document.pdf' }} onExternalLinkOpening={veto} />);
    await waitFor(() => expect(controller.loadUrl).toHaveBeenCalledOnce());
    expect(await bridge.invokeMethodAsync('OnExternalLinkOpeningAsync', generation, 'https://example.com', 1)).toBe(false);
    expect(veto).not.toHaveBeenCalled();

    view.rerender(<CgPdfViewer source={{ kind: 'url', url: '/document.pdf' }} allowExternalLinks onExternalLinkOpening={veto} />);
    await waitFor(() => expect(pdfModule.create).toHaveBeenCalledTimes(2));
    expect(await bridge.invokeMethodAsync('OnExternalLinkOpeningAsync', generation, 'javascript:alert(1)', 1)).toBe(false);
    expect(await bridge.invokeMethodAsync('OnExternalLinkOpeningAsync', generation, 'https://example.com', 1)).toBe(false);
    expect(veto).toHaveBeenCalledOnce();
  });

  it('supports cancellable loading and custom empty/error/loading templates', async () => {
    const actions = createRef<CgPdfViewerActions>();
    render(<CgPdfViewer actionsRef={actions} renderEmpty={() => <span>Choose a statement</span>} onDocumentLoading={() => false} />);
    expect(screen.getByText('Choose a statement')).toBeVisible();
    await waitFor(() => expect(actions.current).not.toBeNull());
    const result = await act(async () => actions.current!.load({ kind: 'url', url: '/blocked.pdf' }));
    expect(result.status).toBe('rejected');
    expect(controller.loadUrl).not.toHaveBeenCalled();
  });
});
