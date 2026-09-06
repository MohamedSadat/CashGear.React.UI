import type { CgMapCoordinate, CgMapMarker, CgMapPolyline, CgMapTileLayer, CgMapViewport } from './CgMap.types';

export function validateMapCoordinate(coordinate: CgMapCoordinate): void {
  if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)
    || coordinate.latitude < -90 || coordinate.latitude > 90 || coordinate.longitude < -180 || coordinate.longitude > 180) {
    throw new RangeError('CgMap latitude must be -90..90 and longitude -180..180.');
  }
}

export function validateMapUrl(value: string): void {
  const containsControl = typeof value === 'string' && [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (!value?.trim() || value.startsWith('//') || value.includes('\\') || containsControl) {
    throw new Error('CgMap URLs must be HTTP(S) or application-relative.');
  }
  try {
    const url = new URL(value, 'https://cashgear.invalid/');
    const explicitScheme = /^[a-z][a-z\d+.-]*:/iu.test(value);
    if ((explicitScheme && url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
      throw new Error('CgMap URLs must use HTTP(S) without embedded credentials.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CgMap')) throw error;
    throw new Error('CgMap URLs must be HTTP(S) or application-relative.', { cause: error });
  }
}

export function validateMapProps(
  viewport: CgMapViewport,
  tileLayer: CgMapTileLayer | null | undefined,
  markers: ReadonlyArray<CgMapMarker>,
  polylines: ReadonlyArray<CgMapPolyline>,
  height: string | number | undefined,
): void {
  validateMapCoordinate(viewport.center);
  if (!Number.isFinite(viewport.zoom) || viewport.zoom < 0 || viewport.zoom > 24) throw new RangeError('CgMap zoom must be between 0 and 24.');
  if (typeof height === 'string' && (!height.trim() || /[;{}]/u.test(height))) throw new Error('CgMap height must be one CSS length.');
  if (tileLayer) {
    validateMapUrl(tileLayer.urlTemplate);
    if (!['{x}', '{y}', '{z}'].every((token) => tileLayer.urlTemplate.includes(token))) throw new Error('CgMap tile URL must contain {x}, {y}, and {z}.');
    const minimum = tileLayer.minimumZoom ?? 0;
    const maximum = tileLayer.maximumZoom ?? 19;
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum > 24 || minimum > maximum) throw new Error('CgMap tile zoom limits are invalid.');
    if (viewport.zoom < minimum || viewport.zoom > maximum) throw new RangeError('CgMap viewport zoom must be within the tile-layer limits.');
    if (!tileLayer.attribution?.length) throw new Error('CgMap tile attribution is required.');
    for (const attribution of tileLayer.attribution) {
      if (!attribution?.text.trim()) throw new Error('CgMap attribution text is required.');
      if (attribution.url !== undefined) validateMapUrl(attribution.url);
    }
  }
  const markerKeys = new Set<string>();
  for (const marker of markers) {
    if (!marker?.key.trim() || markerKeys.has(marker.key)) throw new Error('CgMap marker keys must be non-empty and unique.');
    markerKeys.add(marker.key);
    validateMapCoordinate(marker.position);
  }
  const lineKeys = new Set<string>();
  for (const line of polylines) {
    if (!line?.key.trim() || lineKeys.has(line.key)) throw new Error('CgMap polyline keys must be non-empty and unique.');
    lineKeys.add(line.key);
    if (!line.points || line.points.length < 2) throw new Error('CgMap polylines require at least two points.');
    line.points.forEach(validateMapCoordinate);
    const weight = line.weight ?? 3;
    if (!Number.isFinite(weight) || weight <= 0) throw new RangeError('CgMap polyline weight must be positive and finite.');
  }
}
