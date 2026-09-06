import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CgMap } from '../src';
import type { CgMapActions, CgMapTileLayer } from '../src';
import { validateMapProps, validateMapUrl } from '../src/components/Map/mapValidation';

const mock = vi.hoisted(() => {
  const update = vi.fn();
  const fitBounds = vi.fn();
  const dispose = vi.fn();
  const create = vi.fn((_element: HTMLElement, callbacks: unknown) => ({ update, fitBounds, dispose, callbacks }));
  const load = vi.fn(async () => ({ createMapEngine: create }));
  return { update, fitBounds, dispose, create, load };
});

vi.mock('../src/components/Map/mapEngineLoader', () => ({ loadMapEngine: mock.load }));

const tiles: CgMapTileLayer = {
  urlTemplate: '/fixtures/tiles/{z}/{x}/{y}.svg',
  attribution: [{ text: 'CashGear fixtures', url: '/fixtures/license' }],
  minimumZoom: 0,
  maximumZoom: 8,
};
const viewport = { center: { latitude: 30.0444, longitude: 31.2357 }, zoom: 5 };

describe('CgMap validation', () => {
  it('rejects unsafe URLs, invalid ranges, duplicate keys, and malformed paths', () => {
    for (const url of ['//tiles.test/{z}/{x}/{y}', 'javascript:alert(1)', 'https://user:pass@test/{z}/{x}/{y}', 'https:\\bad']) {
      expect(() => validateMapUrl(url)).toThrow(/URL/);
    }
    expect(() => validateMapProps({ center: { latitude: 91, longitude: 0 }, zoom: 2 }, null, [], [], '20rem')).toThrow(/latitude/);
    expect(() => validateMapProps(viewport, { ...tiles, attribution: [] }, [], [], '20rem')).toThrow(/attribution/);
    expect(() => validateMapProps(viewport, tiles, [{ key: 'a', position: viewport.center }, { key: 'a', position: viewport.center }], [], '20rem')).toThrow(/marker keys/);
    expect(() => validateMapProps(viewport, tiles, [], [{ key: 'line', points: [viewport.center] }], '20rem')).toThrow(/two points/);
    expect(() => validateMapProps(viewport, tiles, [], [{ key: 'line', points: [viewport.center, viewport.center], weight: 0 }], '20rem')).toThrow(/weight/);
  });
});

describe('CgMap', () => {
  beforeEach(() => {
    mock.update.mockClear();
    mock.fitBounds.mockClear();
    mock.dispose.mockClear();
    mock.create.mockClear();
    mock.load.mockClear();
    mock.create.mockImplementation((_element: HTMLElement, callbacks: unknown) => ({ update: mock.update, fitBounds: mock.fitBounds, dispose: mock.dispose, callbacks }));
  });

  it('renders the unconfigured state without importing the map engine', async () => {
    render(<CgMap ariaLabel="Delivery map" />);
    expect(screen.getByRole('region', { name: 'Delivery map' })).toHaveTextContent(/Configure a tile URL/);
    await act(async () => Promise.resolve());
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('initializes once, diffs updates through the adapter, and tears down', async () => {
    const ready = vi.fn();
    const markers = [{ key: 'cairo', position: viewport.center, title: 'Cairo' }];
    const view = render(<CgMap viewport={viewport} tileLayer={tiles} markers={markers} onReady={ready} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    expect(mock.update).toHaveBeenLastCalledWith(expect.objectContaining({ viewport, tileLayer: tiles, markers }));
    expect(ready).toHaveBeenCalledTimes(1);
    view.rerender(<CgMap viewport={viewport} tileLayer={tiles} markers={[...markers, { key: 'giza', position: { latitude: 29.98, longitude: 31.13 } }]} onReady={ready} />);
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.update).toHaveBeenLastCalledWith(expect.objectContaining({ markers: expect.arrayContaining([expect.objectContaining({ key: 'giza' })]) }));
    expect(ready).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mock.dispose).toHaveBeenCalledTimes(1);
  });

  it('reports viewport and marker events and exposes fitBounds', async () => {
    const actions = createRef<CgMapActions>();
    const viewportChanged = vi.fn();
    const markerClicked = vi.fn();
    const marker = { key: 'cairo', position: viewport.center, title: 'Cairo' };
    render(<CgMap actionsRef={actions} defaultViewport={viewport} tileLayer={tiles} markers={[marker]} onViewportChange={viewportChanged} onMarkerClick={markerClicked} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalled());
    const callbacks = mock.create.mock.results[0]?.value.callbacks as {
      viewportChanged: (next: typeof viewport, reason: 'interaction' | 'fitBounds') => void;
      markerClicked: (key: string) => void;
    };
    const next = { center: { latitude: 29.9, longitude: 31.2 }, zoom: 6 };
    act(() => callbacks.viewportChanged(next, 'interaction'));
    expect(viewportChanged).toHaveBeenCalledWith(next, { reason: 'interaction' });
    act(() => callbacks.markerClicked('cairo'));
    expect(markerClicked).toHaveBeenCalledWith('cairo', { marker });
    act(() => actions.current?.fitBounds([viewport.center, next.center]));
    expect(mock.fitBounds).toHaveBeenCalledWith([viewport.center, next.center]);
    expect(() => actions.current?.fitBounds([{ latitude: Number.NaN, longitude: 0 }])).toThrow(/latitude/);
  });

  it('distinguishes tile failures and retries initialization failures', async () => {
    const errors = vi.fn();
    render(<CgMap viewport={viewport} tileLayer={tiles} onError={errors} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalled());
    const callbacks = mock.create.mock.results[0]?.value.callbacks as { tileError: () => void };
    act(() => callbacks.tileError());
    expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'tile' }));
    expect(screen.getByText(/Some map tiles/)).toBeInTheDocument();

    mock.create.mockImplementationOnce(() => { throw new Error('engine failed'); });
    const failed = render(<CgMap viewport={viewport} tileLayer={{ ...tiles, urlTemplate: '/other/{z}/{x}/{y}.svg' }} onError={errors} />);
    await waitFor(() => expect(screen.getByText(/map could not be loaded/)).toBeInTheDocument());
    expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'initialization', cause: expect.any(Error) }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Retry' }).at(-1)!);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(3));
    failed.unmount();
  });
});
