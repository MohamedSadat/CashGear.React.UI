import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgTooltip } from '../src/components/Tooltip';
import type { CgTooltipActions } from '../src/components/Tooltip';

describe('CgTooltip', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 100, left: 100, top: 100, right: 220, bottom: 130, width: 120, height: 30, toJSON: () => ({}) });
  });
  afterEach(() => vi.restoreAllMocks());
  it('renders only its stable target wrapper during SSR and mounts content lazily', () => {
    const html = renderToString(<CgTooltip text="Help"><button>Target</button></CgTooltip>);
    expect(html).toContain('data-cg-tooltip-target');
    expect(html).not.toContain('role="tooltip"');
    render(<CgTooltip text="Help"><button>Target</button></CgTooltip>);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses cancellable hover/focus timers and renderContent precedence', async () => {
    vi.useFakeTimers();
    render(<CgTooltip text="Fallback" renderContent={() => 'Rendered'} openDelay={50} closeDelay={25}><button>Target</button></CgTooltip>);
    const target = screen.getByRole('button', { name: 'Target' });
    fireEvent.pointerOver(target);
    act(() => vi.advanceTimersByTime(49));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve(); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Rendered');
    expect(screen.queryByText('Fallback')).not.toBeInTheDocument();
    fireEvent.pointerOut(target, { relatedTarget: document.body });
    fireEvent.pointerOver(target);
    act(() => vi.advanceTimersByTime(30));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('preserves unrelated aria-describedby tokens and owns only its token', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<CgTooltip text="Description" openDelay={0} closeDelay={0}><button aria-describedby="existing">Target</button></CgTooltip>);
    const target = screen.getByRole('button');
    fireEvent.focus(target);
    await act(async () => { await Promise.resolve(); });
    const tooltip = screen.getByRole('tooltip');
    expect(target.getAttribute('aria-describedby')?.split(' ')).toEqual(['existing', tooltip.id]);
    fireEvent.blur(target, { relatedTarget: document.body });
    await act(async () => { vi.runAllTimers(); await Promise.resolve(); vi.runAllTimers(); });
    expect(target).toHaveAttribute('aria-describedby', 'existing');
    unmount();
    expect(target).toHaveAttribute('aria-describedby', 'existing');
  });

  it('restores rejected controlled visibility without stale terminal callbacks', async () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    const actions = createRef<CgTooltipActions>();
    render(<CgTooltip visible={false} text="Controlled" actionsRef={actions} onShown={shown} onHidden={hidden}><button>Target</button></CgTooltip>);
    await act(() => actions.current!.show());
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    expect(shown).not.toHaveBeenCalled();
    expect(hidden).not.toHaveBeenCalled();
  });

  it('supports manual actions and reports successful placement before teardown', async () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    const actions = createRef<CgTooltipActions>();
    render(<CgTooltip trigger="manual" text="Manual" actionsRef={actions} onShown={shown} onHidden={hidden}><button>Target</button></CgTooltip>);
    expect(await act(() => actions.current!.show())).toBe(true);
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    await waitFor(() => expect(shown).toHaveBeenCalledOnce());
    expect(actions.current?.getVisible()).toBe(true);
    await act(() => actions.current!.hide());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await waitFor(() => expect(hidden).toHaveBeenCalledOnce());
  });

  it('keeps interactive target-to-surface transitions open and click tooltips honor Escape', async () => {
    render(<CgTooltip interactive openDelay={0} closeDelay={0} renderContent={() => <button>Inside</button>}><button>Hover</button></CgTooltip>);
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Hover' }));
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    const inside = screen.getByRole('button', { name: 'Inside' });
    fireEvent.pointerOut(screen.getByRole('button', { name: 'Hover' }), { relatedTarget: inside });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    render(<CgTooltip trigger="click" text="Click help"><button>Click</button></CgTooltip>);
    fireEvent.click(screen.getByRole('button', { name: 'Click' }));
    await waitFor(() => expect(screen.getByText('Click help')).toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Click help')).not.toBeInTheDocument());
  });

  it('validates configuration and cleans up under Strict Mode', () => {
    expect(() => render(<CgTooltip text="x" openDelay={-1}><span>x</span></CgTooltip>)).toThrow(/openDelay/);
    const { unmount } = render(<StrictMode><CgTooltip defaultVisible text="Strict"><button>Target</button></CgTooltip></StrictMode>);
    unmount();
    expect(document.querySelector('[data-cg-tooltip-surface]')).toBeNull();
  });
});
