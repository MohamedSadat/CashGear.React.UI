import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgSelectionToolbar } from './CgSelectionToolbar';
import type { CgToolbarItem } from '../Toolbar';

const items: CgToolbarItem[] = [
  { name: 'bold', text: 'غامق', icon: 'text-bold', iconOnly: true, checked: false },
  { name: 'italic', text: 'مائل', icon: 'text-italic', iconOnly: true },
  { name: 'link', text: 'رابط', icon: 'link', iconOnly: true },
];

describe('CgSelectionToolbar', () => {
  it('floats a named toolbar over the selection while it has a rectangle', () => {
    const { rerender } = render(<CgSelectionToolbar label="التنسيق" items={items} rect={null} />);
    expect(document.querySelector('[data-cg-selection-toolbar]')).toBeNull();
    rerender(<CgSelectionToolbar label="التنسيق" items={items} rect={{ x: 100, y: 200, width: 80, height: 20 }} />);
    const surface = document.querySelector('[data-cg-selection-toolbar="floating"]')!;
    expect(surface).not.toBeNull();
    expect(surface.querySelector('[role="toolbar"]')).toHaveAttribute('aria-label', 'التنسيق');
    expect(surface.querySelectorAll('button')).toHaveLength(3);
  });

  it('keeps focus where it was on a press, except in a text field of its panel', () => {
    render(<CgSelectionToolbar label="التنسيق" items={items} rect={{ x: 10, y: 10, width: 10, height: 10 }} panel={<input aria-label="عنوان الرابط" />} />);
    const button = document.querySelector('[data-cg-selection-toolbar] button')!;
    expect(fireEvent.mouseDown(button)).toBe(false);
    const field = document.querySelector('input[aria-label="عنوان الرابط"]')!;
    expect(fireEvent.mouseDown(field)).toBe(true);
  });

  it('reports Escape inside it, so the host can return focus to the editor', () => {
    const onEscape = vi.fn();
    render(<CgSelectionToolbar label="التنسيق" items={items} rect={{ x: 10, y: 10, width: 10, height: 10 }} onEscape={onEscape} />);
    const button = document.querySelector('[data-cg-selection-toolbar] button')!;
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('docks above an on-screen keyboard', () => {
    const listeners: Record<string, () => void> = {};
    const viewport = { height: 500, offsetTop: 0, addEventListener: (type: string, listener: () => void) => { listeners[type] = listener; }, removeEventListener: vi.fn() };
    vi.stubGlobal('visualViewport', viewport);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    render(<CgSelectionToolbar mode="docked" label="أدوات الكتلة" items={items} />);
    const bar = document.querySelector<HTMLElement>('[data-cg-selection-toolbar="docked"]')!;
    expect(bar.style.insetBlockEnd).toBe('300px');
    viewport.height = 800;
    act(() => listeners.resize?.());
    expect(bar.style.insetBlockEnd).toBe('0px');
    vi.unstubAllGlobals();
  });

  it('needs a label, and an overflow label with autoOverflow', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgSelectionToolbar label=" " items={items} rect={null} />)).toThrow(/label/u);
    expect(() => render(<CgSelectionToolbar label="x" items={items} rect={null} autoOverflow />)).toThrow(/overflowButtonLabel/u);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
