# CgMap

`CgMap` is a lazy, instance-local Leaflet 1.9.4 map. It configures no provider by default and does not request code or tiles until a valid `tileLayer` is mounted.

```tsx
<CgMap
  viewport={viewport}
  onViewportChange={setViewport}
  tileLayer={{
    urlTemplate: '/tiles/{z}/{x}/{y}.png',
    attribution: [{ text: 'Internal GIS' }],
  }}
  markers={[{ key: 'warehouse', position: { latitude: 30.06, longitude: 31.22 }, title: 'Warehouse' }]}
  ariaLabel="Delivery locations"
/>
```

Coordinates must be finite and inside latitude -90..90 and longitude -180..180. Zoom is 0..24 and must fit the tile limits. Tile templates require `{z}`, `{x}`, and `{y}` plus nonempty structured attribution. Marker and polyline keys must be unique; paths require at least two coordinates and a positive finite weight. URLs may be HTTP(S) or application-relative. Protocol-relative values, credentials, backslashes, control characters, and executable schemes are rejected.

The private adapter owns exactly one map per component, updates keyed layers without recreating the map, retains ordinary viewport gesture echoes, reports settled interaction/fit changes, observes resize, and removes every listener, layer, observer, and map on teardown. Marker popup content and attribution text are created with DOM text nodes rather than caller HTML. `actionsRef.fitBounds(points)` is a no-op before initialization or for an empty list.

Initialization and tile failures are distinct `onError` kinds. Retry recreates a failed instance. The empty state does not load Leaflet. Tile selection, terms, attribution, browser-visible credentials, network policy, and CSP remain host responsibilities. Routing, geocoding, draggable markers, and arbitrary popup HTML are excluded.

Leaflet source, CSS, images, license, provenance, and SHA-256 integrity data are checked in under `src/vendor/leaflet`. The locked regeneration project lives in `vendor-src/leaflet`; normal installs and builds do not install Leaflet from npm.
