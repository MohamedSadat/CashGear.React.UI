import '../../vendor/leaflet/leaflet.css';
import * as L from '../../vendor/leaflet/leaflet-src.esm.js';
import markerIconUrl from '../../vendor/leaflet/images/marker-icon.png?url';
import markerIcon2xUrl from '../../vendor/leaflet/images/marker-icon-2x.png?url';
import markerShadowUrl from '../../vendor/leaflet/images/marker-shadow.png?url';
import type { CgMapCoordinate, CgMapPolyline, CgMapTileLayer, CgMapViewport, CgMapMarker } from './CgMap.types';

export interface MapEngineData {
  viewport: CgMapViewport;
  tileLayer: CgMapTileLayer;
  markers: ReadonlyArray<CgMapMarker>;
  polylines: ReadonlyArray<CgMapPolyline>;
}
export interface MapEngineCallbacks {
  viewportChanged: (viewport: CgMapViewport, reason: 'interaction' | 'fitBounds') => void;
  markerClicked: (key: string) => void;
  tileError: () => void;
}
export interface MapEngine { update: (data: MapEngineData) => void; fitBounds: (points: ReadonlyArray<CgMapCoordinate>) => void; dispose: () => void }

const coordinate = (point: CgMapCoordinate): [number, number] => [point.latitude, point.longitude];
const sameViewport = (left: CgMapViewport | undefined, right: CgMapViewport) => Boolean(left)
  && Math.abs(left!.center.latitude - right.center.latitude) < 1e-7
  && Math.abs(left!.center.longitude - right.center.longitude) < 1e-7
  && Math.abs(left!.zoom - right.zoom) < 1e-7;

function attributionHtml(items: CgMapTileLayer['attribution']): string {
  const container = document.createElement('span');
  items.forEach((item, index) => {
    if (index) container.append(document.createTextNode(' · '));
    const part = document.createElement(item.url ? 'a' : 'span');
    part.textContent = item.text;
    if (item.url && part instanceof HTMLAnchorElement) {
      part.href = item.url;
      part.rel = 'noopener noreferrer';
      part.target = '_blank';
    }
    container.append(part);
  });
  return container.innerHTML;
}

export function createMapEngine(element: HTMLElement, callbacks: MapEngineCallbacks): MapEngine {
  let disposed = false;
  let applying = false;
  let fitting = false;
  let parameterViewport: CgMapViewport | undefined;
  let reportedViewport: CgMapViewport | undefined;
  let tileKey = '';
  let tileLayer: L.LeafletTileLayer | undefined;
  let attribution = '';
  let frame = 0;
  const markers = new Map<string, L.LeafletMarker>();
  const markerPopups = new Map<string, string | undefined>();
  const lines = new Map<string, L.LeafletPolyline>();
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = L.map(element, { zoomSnap: 0, zoomAnimation: !reduced, fadeAnimation: !reduced, markerZoomAnimation: !reduced, inertia: !reduced, attributionControl: true });
  map.attributionControl.setPrefix(false);
  const icon = L.icon({ iconUrl: markerIconUrl, iconRetinaUrl: markerIcon2xUrl, shadowUrl: markerShadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
  map.on('moveend', () => {
    if (disposed || applying) return;
    const center = map.getCenter().wrap();
    const viewport = Object.freeze({ center: Object.freeze({ latitude: center.lat, longitude: center.lng }), zoom: map.getZoom() });
    if (!sameViewport(reportedViewport, viewport)) {
      reportedViewport = viewport;
      callbacks.viewportChanged(viewport, fitting ? 'fitBounds' : 'interaction');
    }
    fitting = false;
  });
  const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!disposed && element.clientWidth && element.clientHeight) map.invalidateSize({ pan: false, debounceMoveend: true });
    });
  });
  resize?.observe(element);

  const update = (data: MapEngineData) => {
    if (disposed) return;
    applying = true;
    try {
      const nextTileKey = JSON.stringify(data.tileLayer);
      if (nextTileKey !== tileKey) {
        tileLayer?.remove();
        if (attribution) map.attributionControl.removeAttribution(attribution);
        const minimumZoom = data.tileLayer.minimumZoom ?? 0;
        const maximumZoom = data.tileLayer.maximumZoom ?? 19;
        attribution = attributionHtml(data.tileLayer.attribution);
        map.attributionControl.addAttribution(attribution);
        map.setMinZoom(minimumZoom);
        map.setMaxZoom(maximumZoom);
        let reportedError = false;
        tileLayer = L.tileLayer(data.tileLayer.urlTemplate, { minZoom: minimumZoom, maxZoom: maximumZoom });
        tileLayer.on('tileerror', () => {
          if (!reportedError && !disposed) {
            reportedError = true;
            callbacks.tileError();
          }
        });
        tileLayer.addTo(map);
        tileKey = nextTileKey;
      }
      if (!sameViewport(parameterViewport, data.viewport)) {
        map.setView(coordinate(data.viewport.center), data.viewport.zoom, { animate: false });
        parameterViewport = data.viewport;
        reportedViewport = data.viewport;
      }
      const markerKeys = new Set(data.markers.map((item) => item.key));
      for (const [key, marker] of markers) if (!markerKeys.has(key)) {
        marker.remove();
        markers.delete(key);
        markerPopups.delete(key);
      }
      for (const item of data.markers) {
        let marker = markers.get(item.key);
        if (!marker) {
          marker = L.marker(coordinate(item.position), { icon, title: item.title ?? 'Location', alt: item.title ?? 'Location', keyboard: true }).addTo(map);
          marker.on('click', () => callbacks.markerClicked(item.key));
          markers.set(item.key, marker);
        } else {
          marker.setLatLng(coordinate(item.position));
          marker.setIcon(icon);
        }
        const element = marker.getElement();
        if (element) {
          element.title = item.title ?? 'Location';
          element.setAttribute('alt', item.title ?? 'Location');
          element.dataset.cgMapMarker = item.key;
        }
        if (markerPopups.get(item.key) !== item.popupText) {
          marker.unbindPopup();
          if (item.popupText !== undefined) {
            const content = document.createElement('span');
            content.textContent = item.popupText;
            marker.bindPopup(content);
          }
          markerPopups.set(item.key, item.popupText);
        }
      }
      const lineKeys = new Set(data.polylines.map((item) => item.key));
      for (const [key, line] of lines) if (!lineKeys.has(key)) { line.remove(); lines.delete(key); }
      for (const item of data.polylines) {
        let line = lines.get(item.key);
        if (!line) {
          line = L.polyline(item.points.map(coordinate)).addTo(map);
          lines.set(item.key, line);
        } else line.setLatLngs(item.points.map(coordinate));
        line.setStyle({ color: item.color ?? '#1769ff', weight: item.weight ?? 3 });
      }
      element.dataset.cgMapReady = '';
    } finally {
      applying = false;
    }
  };

  return {
    update,
    fitBounds(points) {
      if (!disposed && points.length) {
        fitting = true;
        map.fitBounds(points.map(coordinate), { padding: [24, 24], animate: false });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      resize?.disconnect();
      map.remove();
      delete element.dataset.cgMapReady;
    },
  };
}
