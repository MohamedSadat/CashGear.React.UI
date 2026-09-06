import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgMap } from './CgMap';
import type { CgMapActions, CgMapTileLayer, CgMapViewport } from './CgMap.types';

const source = 'CashGear.Blazor.UI/Components/Data/Map/* @ 10006424';
const difference = 'React uses immutable geographic descriptors, a private keyed Leaflet adapter, and an actions ref in place of Razor child declarations and async component methods.';
const meta: Meta = { title: 'Phase 23/Map', component: CgMap, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const tiles: CgMapTileLayer = { urlTemplate: '/fixtures/map-tile.svg?z={z}&x={x}&y={y}', attribution: [{ text: 'CashGear local fixture' }], minimumZoom: 0, maximumZoom: 18 };
const cairo: CgMapViewport = { center: { latitude: 30.0444, longitude: 31.2357 }, zoom: 12 };
const markers = [
  { key: 'hq', position: { latitude: 30.0444, longitude: 31.2357 }, title: 'CashGear HQ', popupText: 'CashGear headquarters' },
  { key: 'warehouse', position: { latitude: 30.061, longitude: 31.219 }, title: 'Warehouse', popupText: 'Primary warehouse' },
] as const;
const route = [{ key: 'dispatch', points: markers.map((marker) => marker.position), color: '#b54444', weight: 4 }] as const;

function InteractiveMap() {
  const [viewport, setViewport] = useState(cairo);
  const [selected, setSelected] = useState('None');
  const actions = useRef<CgMapActions>(null);
  return <StoryFrame source={source} difference={difference}>
    <div style={{ width: 'min(780px, calc(100vw - 40px))' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><CgButton appearance="outline" onClick={() => actions.current?.fitBounds(markers.map((marker) => marker.position))}>Fit locations</CgButton><output aria-label="Selected map marker">{selected}</output></div>
      <CgMap actionsRef={actions} viewport={viewport} onViewportChange={setViewport} tileLayer={tiles} markers={markers} polylines={route} onMarkerClick={(_key, details) => setSelected(details.marker.title ?? details.marker.key)} ariaLabel="Delivery locations" height="360px" />
    </div>
  </StoryFrame>;
}

export const Interactive: Story = { render: () => <InteractiveMap /> };
export const MultipleMaps: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: 12, width: 800, maxWidth: 'calc(100vw - 40px)' }}><CgMap defaultViewport={cairo} tileLayer={tiles} markers={markers.slice(0, 1)} ariaLabel="First delivery map" height="260px" /><CgMap defaultViewport={{ center: markers[1].position, zoom: 13 }} tileLayer={tiles} markers={markers.slice(1)} ariaLabel="Second delivery map" height="260px" /></div></StoryFrame> };
export const Empty: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 620 }}><CgMap ariaLabel="Unconfigured map" height="280px" /></div></StoryFrame> };
export const TileError: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 620 }}><CgMap defaultViewport={cairo} tileLayer={{ ...tiles, urlTemplate: '/fixtures/missing-tile.svg?z={z}&x={x}&y={y}' }} ariaLabel="Unavailable map" height="280px" /></div></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <InteractiveMap /> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference} noteDirection="ltr"><div dir="rtl" style={{ width: 'min(680px, calc(100vw - 40px))' }}><CgMap defaultViewport={cairo} tileLayer={tiles} markers={markers} ariaLabel="مواقع التسليم" height="320px" /></div></StoryFrame> };
