import { describe, expect, it, vi } from 'vitest';
import {
  controllerSidebarMode,
  controllerZoomMode,
  fromControllerReason,
  fromControllerZoomMode,
  isSafeExternalUrl,
  mapControllerError,
  normalizeDownloadFileName,
  providerBytes,
  validateConfiguration,
  validateSource,
} from '../src/components/PdfViewer/model';

const validConfiguration = {
  minimumZoom: .25,
  maximumZoom: 5,
  zoomStep: .1,
  maximumDocumentBytes: 1000,
  maximumPageCount: 100,
  zoom: 1,
  currentPage: 1,
  rotation: 0 as const,
  zoomMode: 'fitWidth' as const,
  sidebarMode: 'none' as const,
  assetBaseUrl: '/cashgear-ui/pdfjs/',
};

describe('CgPdfViewer model', () => {
  it('normalizes download names without allowing paths or duplicate extensions', () => {
    expect(normalizeDownloadFileName('../../quarter:1.pdf.pdf')).toBe('quarter-1.pdf');
    expect(normalizeDownloadFileName('   ')).toBe('document.pdf');
    expect(normalizeDownloadFileName('report')).toBe('report.pdf');
  });

  it('accepts only HTTP(S) document sources and known PDF media types', () => {
    expect(() => validateSource({ kind: 'url', url: '/files/report.pdf' })).not.toThrow();
    expect(() => validateSource({ kind: 'url', url: 'javascript:alert(1)' })).toThrow(/HTTP or HTTPS/u);
    expect(() => validateSource({ kind: 'data', data: new Uint8Array(), mimeType: 'text/html' as 'application/pdf' })).toThrow(/application\/pdf/u);
  });

  it('validates bounded viewer configuration', () => {
    expect(() => validateConfiguration(validConfiguration)).not.toThrow();
    expect(() => validateConfiguration({ ...validConfiguration, maximumDocumentBytes: 0 })).toThrow(/document limits/u);
    expect(() => validateConfiguration({ ...validConfiguration, minimumZoom: 2, maximumZoom: 1 })).toThrow(/zoom limits/u);
  });

  it('copies provider bytes, reports progress, and enforces the byte limit', async () => {
    const progress = vi.fn();
    const result = await providerBytes(new Uint8Array([1, 2, 3]), new AbortController().signal, 4, progress);
    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    await expect(providerBytes(new Uint8Array(5), new AbortController().signal, 4, vi.fn())).rejects.toThrow(RangeError);
  });

  it('streams Response bodies with progress and honors cancellation', async () => {
    const progress = vi.fn();
    const response = new Response(new Uint8Array([1, 2, 3, 4]));
    const result = await providerBytes(response, new AbortController().signal, 8, progress);
    expect([...result.bytes]).toEqual([1, 2, 3, 4]);
    expect(progress).toHaveBeenLastCalledWith(4, 4);

    const aborted = new AbortController();
    aborted.abort();
    await expect(providerBytes(new Uint8Array([1]), aborted.signal, 8, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('maps controller vocabulary and filters external protocols', () => {
    expect(controllerZoomMode('fitPage')).toBe('FitPage');
    expect(controllerSidebarMode('thumbnails')).toBe('Thumbnails');
    expect(fromControllerZoomMode('page-width')).toBe('custom');
    expect(fromControllerZoomMode('FitWidth')).toBe('fitWidth');
    expect(fromControllerReason('Navigation', ['scroll', 'navigation'], 'scroll')).toBe('navigation');
    expect(mapControllerError('PageLimitExceeded').code).toBe('pageLimitExceeded');
    expect(isSafeExternalUrl('https://cashgear.example/help')).toBe(true);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });
});
