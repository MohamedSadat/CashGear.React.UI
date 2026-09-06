import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CgGridLayout, CgGridLayoutItem } from '../src';

describe('CgGridLayout', () => {
  it('renders validated named areas and infers columns', () => {
    render(<CgGridLayout data-testid="layout" rows={[{ areas: 'header header' }, { height: 'minmax(10rem, auto)', areas: 'side body' }]} rowGap="1rem"><CgGridLayoutItem area="body" data-testid="body">Body</CgGridLayoutItem></CgGridLayout>);
    const layout = screen.getByTestId('layout');
    expect(layout.style.display).toBe('grid');
    expect(layout.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(layout.style.gridTemplateAreas).toBe('"header header" "side body"');
    expect(layout.style.rowGap).toBe('1rem');
    expect(screen.getByTestId('body').style.gridArea).toBe('body');
  });

  it('supports zero-based indexed placement and protects structured styles', () => {
    const layoutRef = createRef<HTMLDivElement>();
    const itemRef = createRef<HTMLDivElement>();
    render(<CgGridLayout ref={layoutRef} aria-label="Dashboard layout" data-owner="ledger" rows={[{}, {}]} columns={[{}, {}]} style={{ gridTemplateColumns: 'bad', color: 'red' }}><CgGridLayoutItem ref={itemRef} row={0} column={0} columnSpan={2} style={{ gridRow: 'bad' }} data-testid="item">Span</CgGridLayoutItem></CgGridLayout>);
    const layout = screen.getByText('Span').parentElement!;
    expect(layout.style.gridTemplateColumns).toBe('1fr 1fr');
    expect(layout.style.color).toBe('red');
    expect(screen.getByTestId('item').style.gridRow).toBe('1 / span 1');
    expect(screen.getByTestId('item').style.gridColumn).toBe('1 / span 2');
    expect(layoutRef.current).toHaveAttribute('aria-label', 'Dashboard layout');
    expect(layoutRef.current).toHaveAttribute('data-owner', 'ledger');
    expect(itemRef.current).toBe(screen.getByTestId('item'));
  });

  it('rejects malformed areas, unsafe tracks, unknown areas, and mixed placement', () => {
    expect(() => render(<CgGridLayout rows={[{ areas: 'a a' }, { areas: 'a b' }]} />)).toThrow(/rectangle/u);
    expect(() => render(<CgGridLayout rows={[{ areas: 'a a' }, { areas: 'a' }]} />)).toThrow(/equal/u);
    expect(() => render(<CgGridLayout rows={[{ areas: 'a a' }]} columns={[{}]} />)).toThrow(/column count/u);
    expect(() => render(<CgGridLayout rows={[{ height: '1fr;color:red' }]} />)).toThrow(/safe/u);
    expect(() => render(<CgGridLayout rows={[{ areas: 'body' }]}><CgGridLayoutItem area="missing" /></CgGridLayout>)).toThrow(/not declared/u);
    expect(() => render(<CgGridLayout rows={[{ areas: 'body' }]}><CgGridLayoutItem area="body" row={0} /></CgGridLayout>)).toThrow(/cannot be combined/u);
    expect(() => render(<CgGridLayout><CgGridLayoutItem row={-1} /></CgGridLayout>)).toThrow(/at least zero/u);
    expect(() => render(<CgGridLayoutItem />)).toThrow(/inside/u);
  });

  it('preserves keyed child state while descriptors change and supports hidden items and SSR', () => {
    const view = render(<CgGridLayout rows={[{ areas: 'content' }]}><CgGridLayoutItem key="editor" area="content"><input aria-label="Notes" defaultValue="draft" /></CgGridLayoutItem><CgGridLayoutItem visible={false}>Hidden</CgGridLayoutItem></CgGridLayout>);
    const input = screen.getByLabelText<HTMLInputElement>('Notes');
    input.value = 'retained';
    view.rerender(<CgGridLayout rows={[{ areas: 'content content' }]}><CgGridLayoutItem key="editor" area="content"><input aria-label="Notes" defaultValue="draft" /></CgGridLayoutItem></CgGridLayout>);
    expect(screen.getByLabelText('Notes')).toBe(input);
    expect(input).toHaveValue('retained');
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(renderToString(<CgGridLayout><CgGridLayoutItem>SSR</CgGridLayoutItem></CgGridLayout>)).toContain('data-cg-grid-layout');
  });
});
