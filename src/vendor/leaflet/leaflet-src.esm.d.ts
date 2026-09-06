export interface LatLng { lat: number; lng: number; wrap(): LatLng }
export interface LeafletAttributionControl { setPrefix(value: string | false): void; addAttribution(value: string): void; removeAttribution(value: string): void }
export interface LeafletMap {
  attributionControl: LeafletAttributionControl;
  on(type: string, callback: () => void): LeafletMap;
  setView(point: [number, number], zoom: number, options?: object): LeafletMap;
  setMinZoom(zoom: number): LeafletMap;
  setMaxZoom(zoom: number): LeafletMap;
  getCenter(): LatLng;
  getZoom(): number;
  invalidateSize(options?: object): LeafletMap;
  fitBounds(points: Array<[number, number]>, options?: object): LeafletMap;
  remove(): void;
}
export interface LeafletLayer { addTo(map: LeafletMap): this; remove(): void }
export interface LeafletTileLayer extends LeafletLayer { on(type: string, callback: () => void): this }
export interface LeafletMarker extends LeafletLayer {
  on(type: string, callback: () => void): this;
  setLatLng(point: [number, number]): this;
  setIcon(icon: object): this;
  getElement(): HTMLElement | undefined;
  bindPopup(content: HTMLElement): this;
  unbindPopup(): this;
}
export interface LeafletPolyline extends LeafletLayer {
  setLatLngs(points: Array<[number, number]>): this;
  setStyle(style: { color: string; weight: number }): this;
}
export function map(element: HTMLElement, options?: object): LeafletMap;
export function icon(options: object): object;
export function marker(point: [number, number], options?: object): LeafletMarker;
export function polyline(points: Array<[number, number]>): LeafletPolyline;
export function tileLayer(url: string, options?: object): LeafletTileLayer;
