import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgLoadingPanel, CgProgressBar } from '../src';

describe('CgLoadingPanel', () => {
  it('handles rapid delayed show/hide and minimum-duration re-show without flicker', () => {
    vi.useFakeTimers();
    const { rerender } = render(<CgLoadingPanel visible={false} showDelay={20} minimumVisibleDuration={100}>Content</CgLoadingPanel>);
    rerender(<CgLoadingPanel visible showDelay={20} minimumVisibleDuration={100}>Content</CgLoadingPanel>);
    act(() => vi.advanceTimersByTime(10));
    rerender(<CgLoadingPanel visible={false} showDelay={20} minimumVisibleDuration={100}>Content</CgLoadingPanel>);
    act(() => vi.advanceTimersByTime(20));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<CgLoadingPanel visible showDelay={0} minimumVisibleDuration={100}>Content</CgLoadingPanel>);
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<CgLoadingPanel visible={false} showDelay={0} minimumVisibleDuration={100}>Content</CgLoadingPanel>);
    act(() => vi.advanceTimersByTime(50));
    rerender(<CgLoadingPanel visible showDelay={0} minimumVisibleDuration={100}>Content</CgLoadingPanel>);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('status')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('restores preexisting inert state, supports missing portal targets, and cleans up on unmount', () => {
    const target = document.createElement('div');
    const existing = document.createElement('button');
    existing.setAttribute('inert', '');
    const normal = document.createElement('button');
    target.append(existing, normal);
    document.body.append(target);
    const view = render(<CgLoadingPanel mode="portal" target={target} visible>Loading</CgLoadingPanel>);
    expect(existing).toHaveAttribute('inert');
    expect(normal).toHaveAttribute('inert');
    view.unmount();
    expect(existing).toHaveAttribute('inert');
    expect(normal).not.toHaveAttribute('inert');
    target.remove();

    const fallback = render(<CgLoadingPanel mode="portal" target="#missing-target" visible>Fallback</CgLoadingPanel>);
    expect(document.body.querySelector('[data-cg-loading-overlay]')).toBeInTheDocument();
    fallback.unmount();
  });

  it('dismisses only the top overlay by Escape, supports backdrop click, and leaves nonblocking content active', () => {
    const first = vi.fn();
    const second = vi.fn();
    const click = vi.fn();
    const view = render(<><CgLoadingPanel mode="overlay" visible dismissOnEscape onVisibleChange={first}>one</CgLoadingPanel><CgLoadingPanel mode="overlay" visible dismissOnEscape onVisibleChange={second}>two</CgLoadingPanel><CgLoadingPanel mode="overlay" visible blocking={false} dismissOnClick onVisibleChange={click}><button>Usable</button></CgLoadingPanel></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(second).not.toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    const panels = screen.getAllByRole('status');
    expect(panels[2]).toHaveAttribute('data-blocking', 'false');
    fireEvent.click(panels[2]!);
    expect(click).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Usable' }).closest('[inert]')).toBeNull();
    view.rerender(<><CgLoadingPanel mode="overlay" visible dismissOnEscape onVisibleChange={first}>one</CgLoadingPanel><CgLoadingPanel mode="overlay" visible dismissOnEscape onVisibleChange={second}>two</CgLoadingPanel></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(second).toHaveBeenCalledWith(false);
    expect(first).not.toHaveBeenCalled();
  });

  it('validates nonnegative timing values and honors hidden-content policy', async () => {
    expect(() => render(<CgLoadingPanel showDelay={-1} />)).toThrow(/showDelay/);
    expect(() => render(<CgLoadingPanel minimumVisibleDuration={-1} />)).toThrow(/minimumVisibleDuration/);
    const { rerender } = render(<CgLoadingPanel visible={false} showContent={false}>Secret</CgLoadingPanel>);
    expect(screen.getByText('Secret')).toBeInTheDocument();
    rerender(<CgLoadingPanel visible showContent={false}>Secret</CgLoadingPanel>);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('contains and returns focus only when explicitly requested', async () => {
    const view = render(<><button>Origin</button><CgLoadingPanel visible={false} mode="overlay" trapFocus indicator="custom" customIndicator={<><button>First action</button><button>Last action</button></>}>Blocked</CgLoadingPanel></>);
    const origin = screen.getByRole('button', { name: 'Origin' });
    origin.focus();
    view.rerender(<><button>Origin</button><CgLoadingPanel visible mode="overlay" trapFocus indicator="custom" customIndicator={<><button>First action</button><button>Last action</button></>}>Blocked</CgLoadingPanel></>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus());
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    origin.focus();
    expect(first).toHaveFocus();
    view.rerender(<><button>Origin</button><CgLoadingPanel visible={false} mode="overlay" trapFocus indicator="custom" customIndicator={<button>First action</button>}>Blocked</CgLoadingPanel></>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Origin' })).toHaveFocus());
  });

  it('tracks portal geometry and selector target replacement', async () => {
    const first = document.createElement('div');
    first.id = 'portal-host';
    first.getBoundingClientRect = () => ({ x: 10, y: 20, left: 10, top: 20, right: 130, bottom: 80, width: 120, height: 60, toJSON: () => ({}) });
    first.append(document.createElement('button'));
    document.body.append(first);
    const view = render(<CgLoadingPanel mode="portal" target="#portal-host" visible>Portal</CgLoadingPanel>);
    const panel = screen.getByRole('status');
    expect(panel).toHaveStyle({ position: 'fixed', left: '10px', top: '20px', width: '120px', height: '60px', visibility: 'visible' });
    expect(first.firstElementChild).toHaveAttribute('inert');

    const second = document.createElement('div');
    second.id = 'portal-host';
    second.getBoundingClientRect = () => ({ x: 30, y: 40, left: 30, top: 40, right: 230, bottom: 140, width: 200, height: 100, toJSON: () => ({}) });
    second.append(document.createElement('button'));
    first.replaceWith(second);
    await waitFor(() => expect(panel).toHaveStyle({ left: '30px', top: '40px', width: '200px', height: '100px' }));
    expect(first.firstElementChild).not.toHaveAttribute('inert');
    expect(second.firstElementChild).toHaveAttribute('inert');
    view.unmount();
    expect(second.firstElementChild).not.toHaveAttribute('inert');
    second.remove();
  });

  it('rejects focus containment where blocking cannot be guaranteed', () => {
    expect(() => render(<CgLoadingPanel mode="inline" visible trapFocus />)).toThrow(/trapFocus/u);
    expect(() => render(<CgLoadingPanel mode="overlay" visible blocking={false} trapFocus />)).toThrow(/trapFocus/u);
  });
});

describe('CgProgressBar', () => {
  it('exposes determinate and indeterminate ARIA, clamps visuals, and formats labels', () => {
    const { rerender } = render(<CgProgressBar value={150} min={0} max={100} showLabel />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();
    rerender(<CgProgressBar label="Loading inventory" />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Loading inventory');
  });

  it('validates finite values and a positive range', () => {
    expect(() => render(<CgProgressBar value={Number.NaN} />)).toThrow(/value/);
    expect(() => render(<CgProgressBar min={1} max={1} />)).toThrow(/max/);
    expect(() => render(<CgProgressBar min={2} max={1} />)).toThrow(/max/);
  });
});
