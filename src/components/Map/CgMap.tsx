import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useControllableState, useMergedRefs } from '../../hooks';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgLoadingPanel } from '../LoadingPanel';
import styles from './CgMap.module.css';
import type { MapEngine } from './mapEngine';
import { loadMapEngine } from './mapEngineLoader';
import type { CgMapActions, CgMapErrorDetails, CgMapLabels, CgMapProps } from './CgMap.types';
import { validateMapCoordinate, validateMapProps } from './mapValidation';

const DEFAULT_VIEWPORT = Object.freeze({ center: Object.freeze({ latitude: 0, longitude: 0 }), zoom: 2 });
const EMPTY_MARKERS = Object.freeze([]);
const EMPTY_POLYLINES = Object.freeze([]);
const DEFAULT_LABELS: CgMapLabels = {
  empty: 'Configure a tile URL and attribution to display the map.',
  loading: 'Loading map',
  retry: 'Retry',
  initializationError: 'The map could not be loaded. Check the tile configuration and retry.',
  tileError: 'Some map tiles could not be loaded. Check the connection or retry.',
};

export const CgMap = forwardRef<HTMLDivElement, CgMapProps>(function CgMap({
  viewport: controlledViewport,
  defaultViewport = DEFAULT_VIEWPORT,
  onViewportChange,
  tileLayer,
  markers = EMPTY_MARKERS,
  polylines = EMPTY_POLYLINES,
  onMarkerClick,
  onReady,
  onError,
  height = '400px',
  ariaLabel = 'Map',
  labels,
  actionsRef,
  className,
  style,
  ...nativeProps
}, forwardedRef) {
  const [viewport, setViewport] = useControllableState(controlledViewport, defaultViewport, 'CgMap');
  validateMapProps(viewport, tileLayer, markers, polylines, height);
  const text = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const generation = useRef(0);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const callbacks = useRef({ onViewportChange, onMarkerClick, onReady, onError });
  callbacks.current = { onViewportChange, onMarkerClick, onReady, onError };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CgMapErrorDetails | null>(null);
  const [retry, setRetry] = useState(0);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const disposeEngine = useCallback(() => {
    generation.current += 1;
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => () => disposeEngine(), [disposeEngine]);
  useEffect(() => {
    if (!tileLayer) {
      disposeEngine();
      setLoading(false);
      setError(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentGeneration = ++generation.current;
    const data = { viewport, tileLayer, markers, polylines };
    if (engineRef.current) {
      engineRef.current.update(data);
      return;
    }
    setLoading(true);
    setError(null);
    void loadMapEngine().then(({ createMapEngine }) => {
      if (generation.current !== currentGeneration || !canvas.isConnected) return;
      const engine = createMapEngine(canvas, {
        viewportChanged: (next, reason) => {
          setViewport(next);
          callbacks.current.onViewportChange?.(next, Object.freeze({ reason }));
        },
        markerClicked: (key) => {
          const marker = markersRef.current.find((candidate) => candidate.key === key);
          if (marker) callbacks.current.onMarkerClick?.(key, Object.freeze({ marker }));
        },
        tileError: () => {
          const details = Object.freeze({ kind: 'tile', message: text.tileError }) satisfies CgMapErrorDetails;
          setLoading(false);
          setError(details);
          callbacks.current.onError?.(details);
        },
      });
      if (generation.current !== currentGeneration) { engine.dispose(); return; }
      engineRef.current = engine;
      engine.update(data);
      setLoading(false);
      callbacks.current.onReady?.();
    }).catch((cause: unknown) => {
      if (generation.current !== currentGeneration) return;
      const details = Object.freeze({ kind: 'initialization', message: text.initializationError, cause }) satisfies CgMapErrorDetails;
      setLoading(false);
      setError(details);
      callbacks.current.onError?.(details);
    });
  }, [disposeEngine, markers, polylines, retry, setViewport, text.initializationError, text.tileError, tileLayer, viewport]);

  useImperativeHandle(actionsRef, (): CgMapActions => ({
    fitBounds(points) {
      points.forEach(validateMapCoordinate);
      engineRef.current?.fitBounds(points);
    },
  }), []);

  const retryLoad = () => {
    disposeEngine();
    setError(null);
    setRetry((value) => value + 1);
  };
  return <div
    {...nativeProps}
    ref={mergedRef}
    className={cx(styles.root, className)}
    style={{ ...style, height }}
    role="region"
    aria-label={ariaLabel}
    aria-busy={loading || undefined}
    data-cg-map=""
  >
    <div ref={canvasRef} className={styles.canvas} hidden={!tileLayer} aria-label={ariaLabel} dir="ltr" />
    {!tileLayer ? <div className={styles.empty}>{text.empty}</div> : null}
    {loading ? <div className={styles.loading}><CgLoadingPanel visible mode="inline" blocking={false} text={text.loading} /></div> : null}
    {error ? <div className={styles.error} role="status"><span>{error.message}</span><CgButton appearance="outline" onClick={retryLoad}>{text.retry}</CgButton></div> : null}
  </div>;
});
