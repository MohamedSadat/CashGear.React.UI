import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgChart, CG_CHART_PRIMARY_AXIS_NAME } from '../src/components/Chart';
import type { CgChartActions, CgChartPointRef, CgChartSeriesDescriptor } from '../src/components/Chart';

interface Datum {
  readonly month: string;
  readonly revenue: number | null;
  readonly cost: number;
}

const data: ReadonlyArray<Datum> = [
  { month: 'Jan', revenue: 12, cost: 8 },
  { month: 'Feb', revenue: 18, cost: 11 },
  { month: 'Mar', revenue: null, cost: 9 },
];
const series: ReadonlyArray<CgChartSeriesDescriptor<Datum>> = [
  { type: 'bar', name: 'Revenue', argument: (item) => item.month, value: (item) => item.revenue },
  { type: 'line', name: 'Cost', argument: (item) => item.month, value: (item) => item.cost, lineStyle: 'monotone' },
];

describe('CgChart', () => {
  it('exports the primary axis constant and renders deterministic SSR SVG/table layout', () => {
    expect(CG_CHART_PRIMARY_AXIS_NAME).toBe('primary');
    const html = renderToString(<CgChart data={data} series={series} title="Quarterly results" description="Revenue and cost by month" />);
    expect(html).toContain('data-cg-chart-width="640"');
    expect(html).toContain('data-cg-chart-height="320"');
    expect(html).toContain('viewBox="0 0 640 320"');
    expect(html).toContain('role="graphics-symbol"');
    expect(html).toContain('<details');
    expect(html).not.toContain('[object Date]');
  });

  it('renders loading, empty, and too-small states while retaining accessible table data', () => {
    const { rerender } = render(<CgChart data={data} series={series} loading title="State chart" dataTableMode="visible" />);
    expect(screen.getByText('Loading chart data')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('table')).toBeInTheDocument();
    rerender(<CgChart data={[]} series={series} renderEmpty={() => <strong>Nothing here</strong>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    rerender(<CgChart key="too-small" data={data} series={series} fallbackWidth={159} fallbackHeight={119} dataTableMode="visible" />);
    expect(screen.getByText('Not enough room to draw this chart')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('supports series-owned data and does not mutate descriptors or source items', () => {
    const owned = [{ month: 'Owned', revenue: 7, cost: 4 }];
    const descriptor = { type: 'bar', name: 'Owned data', data: owned, argument: (item: Datum) => item.month, value: (item: Datum) => item.revenue } as const;
    render(<CgChart data={null} series={[descriptor]} dataTableMode="visible" />);
    expect(screen.getByRole('rowheader', { name: 'Owned' })).toBeInTheDocument();
    expect(owned).toEqual([{ month: 'Owned', revenue: 7, cost: 4 }]);
    expect(descriptor.data).toBe(owned);
  });

  it('invokes customization only during source construction, not selection or visibility projection', async () => {
    const customize = vi.fn(() => ({ color: '#ff0000' }));
    render(<CgChart data={data} series={series} customizePoint={customize} selectionMode="multiple" />);
    expect(customize).toHaveBeenCalledTimes(6);
    fireEvent.click(document.querySelector<SVGElement>('[data-cg-chart-point]')!);
    await waitFor(() => expect(document.querySelector('[data-cg-selected="true"]')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Cost/u }));
    expect(customize).toHaveBeenCalledTimes(6);
  });

  it('keeps rejected controlled selection authoritative and reports accepted state on activation', async () => {
    const proposed = vi.fn();
    const accepted = vi.fn();
    const activate = vi.fn();
    const { rerender } = render(<CgChart
      data={data}
      series={series}
      selectionMode="single"
      selectedPoints={[]}
      onSelectedPointsChange={proposed}
      onSelectionChanged={accepted}
      onPointActivate={activate}
    />);
    const first = document.querySelector<SVGElement>('[data-cg-chart-point]')!;
    fireEvent.click(first);
    expect(proposed).toHaveBeenCalledWith(
      [{ seriesName: 'Revenue', pointIndex: 0 }],
      expect.objectContaining({ reason: 'activation' }),
    );
    expect(first).not.toHaveAttribute('data-cg-selected');
    await waitFor(() => expect(activate).toHaveBeenCalledWith(expect.objectContaining({ isSelected: false })));
    expect(accepted).not.toHaveBeenCalled();

    rerender(<CgChart
      data={data}
      series={series}
      selectionMode="single"
      selectedPoints={[{ seriesName: 'Revenue', pointIndex: 0 }]}
      onSelectedPointsChange={proposed}
      onSelectionChanged={accepted}
      onPointActivate={activate}
    />);
    await waitFor(() => expect(accepted).toHaveBeenCalledWith(expect.objectContaining({ selectedPoints: [{ seriesName: 'Revenue', pointIndex: 0 }] })));
    expect(document.querySelector('[data-cg-selected="true"]')).toBeInTheDocument();
  });

  it('orders uncontrolled selection proposal, accepted callback, activation, and live announcement', async () => {
    const calls: string[] = [];
    render(<CgChart
      data={data}
      series={series}
      selectionMode="multiple"
      onSelectedPointsChange={(_, detail) => { calls.push('proposal'); expect(Object.isFrozen(detail)).toBe(true); }}
      onSelectionChanged={(detail) => { calls.push('accepted'); expect(Object.isFrozen(detail.selectedPoints)).toBe(true); }}
      onPointActivate={(detail) => { calls.push(`activation:${String(detail.isSelected)}`); }}
    />);
    fireEvent.click(document.querySelector<SVGElement>('[data-cg-chart-point]')!, { ctrlKey: true });
    await waitFor(() => expect(calls).toEqual(['proposal', 'accepted', 'activation:true']));
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/Revenue, Jan, 12 selected/u);
  });

  it('uses native legend buttons, respects controlled visibility rejection, and keeps one series visible', () => {
    const change = vi.fn();
    const { rerender } = render(<CgChart data={data} series={series} visibleSeriesNames={['Revenue', 'Cost']} onVisibleSeriesNamesChange={change} />);
    const cost = screen.getByRole('button', { name: /Cost/u });
    fireEvent.click(cost);
    expect(change).toHaveBeenCalledWith(['Revenue']);
    expect(cost).toHaveAttribute('aria-pressed', 'true');
    rerender(<CgChart key="one-visible" data={data} series={series} defaultVisibleSeriesNames={['Revenue']} />);
    const only = screen.getByRole('button', { name: /Revenue/u });
    fireEvent.click(only);
    expect(only).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes synchronous browser-safe actions and strips interaction metadata from SVG export', async () => {
    const actions = createRef<CgChartActions>();
    const change = vi.fn();
    render(<CgChart data={data} series={series} actionsRef={actions} selectionMode="multiple" onSelectedPointsChange={change} />);
    expect(actions.current?.focus()).toBe(true);
    expect(actions.current?.getActivePoint()).toEqual({ seriesName: 'Revenue', pointIndex: 0 });
    expect(actions.current?.setSeriesVisible('Unknown', false)).toBe(false);
    expect(actions.current?.selectPoints([{ seriesName: 'Cost', pointIndex: 1 }])).toBe(true);
    expect(change).toHaveBeenCalledWith([{ seriesName: 'Cost', pointIndex: 1 }], expect.objectContaining({ reason: 'action' }));
    const svg = actions.current?.getSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('<title>Chart</title>');
    expect(svg).not.toContain('data-cg-chart-point');
    expect(svg).not.toContain('data-cg-interactive-only');
    expect(svg).not.toContain('aria-');
    expect(svg).not.toContain(' role=');
    expect(svg).not.toContain('tabindex');
    expect(actions.current?.resetSelection()).toBe(false);
    await Promise.resolve();
  });
  it('uses tooltip formatting without changing table values and activates pie slices from the legend', async () => {
    const activate = vi.fn();
    render(<CgChart
      data={[{ month: 'Cash', revenue: 3, cost: 0 }, { month: 'Credit', revenue: 1, cost: 0 }]}
      series={[{ type: 'donut', name: 'Mix', argument: (item) => item.month, value: (item) => item.revenue }]}
      tooltip={{ valueFormatter: (value) => `tooltip:${String(value)}` }}
      dataTableMode="visible"
      onPointActivate={activate}
    />);
    const firstPoint = document.querySelector<SVGElement>('[data-cg-chart-point]')!;
    expect(firstPoint).toHaveAttribute('data-cg-value', 'tooltip:3');
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cash/u }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith(expect.objectContaining({ seriesName: 'Mix', pointIndex: 0 })));
  });

  it('supports keyboard roving focus, cross-series navigation, RTL arrows, and Escape', () => {
    const { rerender } = render(<CgChart data={data} series={series} />);
    const points = [...document.querySelectorAll<SVGElement>('[data-cg-chart-point]')];
    expect(points.filter((point) => point.getAttribute('tabindex') === '0')).toHaveLength(1);
    fireEvent.keyDown(points[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(points[1]);
    fireEvent.keyDown(points[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAttribute('data-cg-series-name', 'Cost');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    rerender(<div dir="rtl"><CgChart data={data} series={series} direction="rtl" /></div>);
    const rtlPoints = [...document.querySelectorAll<SVGElement>('[data-cg-chart-point]')];
    fireEvent.keyDown(rtlPoints[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(rtlPoints[1]);
  });

  it('uses image semantics when keyboard navigation is disabled and survives Strict Mode replay', () => {
    const activate = vi.fn();
    render(<StrictMode><CgChart data={data} series={series} enableKeyboardNavigation={false} title="Static chart" description="A static summary" onPointActivate={activate} /></StrictMode>);
    expect(screen.getByRole('img', { name: /Static chart.*static summary/u })).toBeInTheDocument();
    const point: CgChartPointRef = { seriesName: 'Revenue', pointIndex: 0 };
    expect(point).toEqual({ seriesName: 'Revenue', pointIndex: 0 });
    fireEvent.click(document.querySelector<SVGElement>('[data-cg-chart-point]')!);
    expect(activate).not.toHaveBeenCalled();
  });
});
