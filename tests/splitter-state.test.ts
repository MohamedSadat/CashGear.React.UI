import { describe, expect, it } from 'vitest';
import type { CgSplitterPaneDescriptor, CgSplitterState } from '../src';
import {
  normalizeSplitterPanes,
  normalizeSplitterState,
  parseSplitterLength,
} from '../src/components/Splitter/splitterState';

const renderContent = () => 'content';

describe('CgSplitter normalization', () => {
  it('canonicalizes supported fixed and flexible lengths', () => {
    expect(parseSplitterLength(12.34567, 'size', true, '1fr').css).toBe('12.346px');
    expect(parseSplitterLength(' 25% ', 'size', true, '1fr').css).toBe('25%');
    expect(parseSplitterLength('*', 'size', true, '1fr').css).toBe('1fr');
    expect(parseSplitterLength('2.5*', 'size', true, '1fr').css).toBe('2.5fr');
    expect(parseSplitterLength('3FR', 'size', true, '1fr').css).toBe('3fr');
    for (const unit of ['px', 'rem', 'em', 'vw', 'vh', 'vmin', 'vmax', 'ch']) {
      expect(parseSplitterLength(`2${unit}`, 'size', true, '1fr').css).toBe(`2${unit}`);
    }
  });

  it('rejects invalid lengths, flexible bounds, and comparable inverted bounds', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, '-2px', 'auto', 'calc(1px)', '0fr', '0*']) {
      expect(() => parseSplitterLength(value, 'size', true, '1fr')).toThrow();
    }
    expect(() => parseSplitterLength('1fr', 'minimum', false, '0px')).toThrow(/does not accept flexible/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', minimumSize: '20px', maximumSize: '10px', renderContent }])).toThrow(/maximumSize/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', minimumSize: '2rem', maximumSize: '10px', renderContent }])).not.toThrow();
  });

  it('validates descriptors and copies caller-owned metadata', () => {
    const style = { color: 'red' };
    const dataAttributes = { 'data-test-pane': 'alpha' } as const;
    const descriptor: CgSplitterPaneDescriptor = { key: ' alpha ', style, dataAttributes, renderContent };
    const panes = normalizeSplitterPanes([descriptor]);
    expect(panes[0]?.key).toBe('alpha');
    expect(panes[0]?.descriptor).not.toBe(descriptor);
    expect(panes[0]?.descriptor.style).not.toBe(style);
    expect(panes[0]?.descriptor.dataAttributes).not.toBe(dataAttributes);
    expect(Object.isFrozen(panes[0]?.descriptor)).toBe(true);
    expect(Object.isFrozen(panes[0]?.descriptor.style)).toBe(true);
    style.color = 'blue';
    expect(panes[0]?.descriptor.style?.color).toBe('red');

    expect(() => normalizeSplitterPanes([])).toThrow(/at least one/u);
    expect(() => normalizeSplitterPanes([{ key: ' ', renderContent }])).toThrow(/nonempty key/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', renderContent }, { key: ' a ', renderContent }])).toThrow(/duplicate key/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', visible: false, renderContent }])).toThrow(/visible descriptor/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', defaultCollapsed: true, renderContent }])).toThrow(/collapsible/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', dataAttributes: { 'aria-label': 'bad' } as never, renderContent }])).toThrow(/data attribute/u);
    expect(() => normalizeSplitterPanes([{ key: 'a', dataAttributes: { 'data-cg-open': true }, renderContent }])).toThrow(/component-owned/u);
  });

  it('reconciles untrusted state in descriptor order with per-pane fallback', () => {
    const panes = normalizeSplitterPanes([
      { key: 'a', size: '2*', collapsible: true, renderContent },
      { key: 'b', size: 80, collapsible: true, renderContent },
      { key: 'c', size: '30%', visible: false, renderContent },
    ]);
    const stored = {
      version: 1,
      panes: [
        { key: 'unknown', size: '100px' },
        { key: ' a ', size: 'invalid' },
        { key: 'a', size: 125 },
        { key: 'a', size: 250 },
        { key: 'b', size: '4rem' },
      ],
      collapsedPaneKeys: ['a', 'b', 'unknown'],
    } as unknown as CgSplitterState;
    const result = normalizeSplitterState(panes, stored);
    expect(result.panes).toEqual([
      { key: 'a', size: '125px' },
      { key: 'b', size: '4rem' },
      { key: 'c', size: '30%' },
    ]);
    expect(result.collapsedPaneKeys).toEqual(['b']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.panes)).toBe(true);
    expect(Object.isFrozen(result.panes[0])).toBe(true);
    expect(Object.isFrozen(result.collapsedPaneKeys)).toBe(true);
  });

  it('rejects unsupported versions and applies descriptor fallback for missing state', () => {
    const panes = normalizeSplitterPanes([
      { key: 'a', size: '3fr', renderContent },
      { key: 'b', size: 100, collapsible: true, defaultCollapsed: true, renderContent },
    ]);
    expect(normalizeSplitterState(panes)).toEqual({
      version: 1,
      panes: [{ key: 'a', size: '3fr' }, { key: 'b', size: '100px' }],
      collapsedPaneKeys: ['b'],
    });
    expect(() => normalizeSplitterState(panes, { version: 2 } as unknown as CgSplitterState)).toThrow(/version 2/u);
  });
});
