import type { CSSProperties, HTMLAttributes, Ref } from 'react';

export interface CgMapCoordinate { readonly latitude: number; readonly longitude: number }
export interface CgMapViewport { readonly center: CgMapCoordinate; readonly zoom: number }
export interface CgMapAttribution { readonly text: string; readonly url?: string }
export interface CgMapTileLayer {
  readonly urlTemplate: string;
  readonly attribution: ReadonlyArray<CgMapAttribution>;
  readonly minimumZoom?: number;
  readonly maximumZoom?: number;
}
export interface CgMapMarker {
  readonly key: string;
  readonly position: CgMapCoordinate;
  readonly title?: string;
  readonly popupText?: string;
}
export interface CgMapPolyline {
  readonly key: string;
  readonly points: ReadonlyArray<CgMapCoordinate>;
  readonly color?: string;
  readonly weight?: number;
}
export type CgMapErrorKind = 'initialization' | 'tile';
export interface CgMapErrorDetails { readonly kind: CgMapErrorKind; readonly message: string; readonly cause?: unknown }
export interface CgMapViewportChangeDetails { readonly reason: 'interaction' | 'fitBounds' }
export interface CgMapMarkerClickDetails { readonly marker: CgMapMarker }
export interface CgMapLabels {
  empty: string;
  loading: string;
  retry: string;
  initializationError: string;
  tileError: string;
}
export interface CgMapActions { fitBounds: (points: ReadonlyArray<CgMapCoordinate>) => void }

type NativeMapProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'>;
export interface CgMapProps extends NativeMapProps {
  viewport?: CgMapViewport;
  defaultViewport?: CgMapViewport;
  onViewportChange?: (viewport: CgMapViewport, details: CgMapViewportChangeDetails) => void;
  tileLayer?: CgMapTileLayer | null;
  markers?: ReadonlyArray<CgMapMarker>;
  polylines?: ReadonlyArray<CgMapPolyline>;
  onMarkerClick?: (key: string, details: CgMapMarkerClickDetails) => void;
  onReady?: () => void;
  onError?: (details: CgMapErrorDetails) => void;
  height?: CSSProperties['height'];
  ariaLabel?: string;
  labels?: Partial<CgMapLabels>;
  actionsRef?: Ref<CgMapActions>;
}
