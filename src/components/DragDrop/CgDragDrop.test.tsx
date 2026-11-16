import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgDragHandle, CgDropIndicator } from './CgDragDrop';
import type { CgDropIndicatorHandle } from './CgDragDrop.types';
import { cgEdgeScrollStep, cgStartsDrag, cgTrackDrag } from './dragTracking';

function pointer(type: string, init: { x: number; y: number; id?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(event, { clientX: init.x, clientY: init.y, pointerId: init.id ?? 1, button: 0 });
  return event;
}

describe('drag helpers', () => {
  it('scrolls faster nearer an edge, and not in the middle', () => {
    expect(cgEdgeScrollStep(500, 0, 1000)).toBe(0);
    expect(cgEdgeScrollStep(0, 0, 1000)).toBe(-18);
    expect(cgEdgeScrollStep(24, 0, 1000)).toBe(-9);
    expect(cgEdgeScrollStep(1000, 0, 1000)).toBe(18);
  });

  it('starts a drag on the item, not on a control inside it', () => {
    const card = document.createElement('div');
    card.innerHTML = '<span>عنوان</span><button>×</button><div data-cg-no-drag><i>x</i></div>';
    expect(cgStartsDrag(card.querySelector('span'), card)).toBe(true);
    expect(cgStartsDrag(card.querySelector('button'), card)).toBe(false);
    expect(cgStartsDrag(card.querySelector('i'), card)).toBe(false);
    expect(cgStartsDrag(card, card)).toBe(true);
  });

  it('becomes a drag past the threshold, follows with a copy, and drops once', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const card = document.createElement('div');
    card.id = 'card-1';
    card.textContent = 'بطاقة';
    document.body.append(card);
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onDrop = vi.fn();
    cgTrackDrag(pointer('pointerdown', { x: 10, y: 10 }), card, { onStart, onMove, onDrop });
    window.dispatchEvent(pointer('pointermove', { x: 12, y: 11 }));
    expect(onStart).not.toHaveBeenCalled();
    window.dispatchEvent(pointer('pointermove', { x: 30, y: 40 }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(card).toHaveAttribute('data-cg-dragging');
    const ghost = document.querySelector<HTMLElement>('[data-cg-drag-ghost]')!;
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    expect(ghost.id).toBe('');
    vi.advanceTimersByTime(20);
    expect(onMove).toHaveBeenLastCalledWith(30, 40);
    expect(ghost.style.transform).toBe('translate3d(20px, 30px, 0)');
    window.dispatchEvent(pointer('pointerup', { x: 31, y: 41 }));
    expect(onDrop).toHaveBeenCalledWith(31, 41);
    expect(document.querySelector('[data-cg-drag-ghost]')).toBeNull();
    expect(card).not.toHaveAttribute('data-cg-dragging');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    card.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    card.remove();
  });

  it('cancels on Escape and through the stop function, without a drop', () => {
    const card = document.createElement('div');
    document.body.append(card);
    const onCancel = vi.fn();
    const onDrop = vi.fn();
    cgTrackDrag(pointer('pointerdown', { x: 0, y: 0 }), card, { onCancel, onDrop, ghost: false });
    window.dispatchEvent(pointer('pointermove', { x: 20, y: 0 }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    window.dispatchEvent(pointer('pointerup', { x: 20, y: 0 }));
    expect(onDrop).not.toHaveBeenCalled();
    const stop = cgTrackDrag(pointer('pointerdown', { x: 0, y: 0 }), card, { onCancel, onDrop });
    window.dispatchEvent(pointer('pointermove', { x: 20, y: 0 }));
    stop();
    expect(onCancel).toHaveBeenCalledTimes(2);
    card.remove();
  });

  it('leaves a click a click', () => {
    const card = document.createElement('div');
    document.body.append(card);
    const onDrop = vi.fn();
    cgTrackDrag(pointer('pointerdown', { x: 0, y: 0 }), card, { onDrop });
    window.dispatchEvent(pointer('pointerup', { x: 1, y: 1 }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    card.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
    card.remove();
  });
});

describe('CgDragHandle', () => {
  it('is a named button that moves with the arrows', () => {
    const onKeyboardMove = vi.fn();
    render(<CgDragHandle label="اسحب للنقل" onKeyboardMove={onKeyboardMove} />);
    const handle = screen.getByRole('button', { name: 'اسحب للنقل' });
    expect(handle).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onKeyboardMove.mock.calls).toEqual([[-1], [1]]);
  });
});

describe('CgDropIndicator', () => {
  it('is moved and hidden through its handle with logical offsets', () => {
    const ref = createRef<CgDropIndicatorHandle>();
    const { container } = render(<CgDropIndicator ref={ref} />);
    const line = container.querySelector<HTMLElement>('[data-cg-drop-indicator]')!;
    expect(line).toHaveAttribute('aria-hidden', 'true');
    expect(line.hidden).toBe(true);
    act(() => ref.current!.show({ block: 40, inline: 12, length: 200 }));
    expect(line.hidden).toBe(false);
    expect(line.style.insetBlockStart).toBe('40px');
    expect(line.style.insetInlineStart).toBe('12px');
    expect(line.style.inlineSize).toBe('200px');
    act(() => ref.current!.show({ orientation: 'vertical', block: 0, inline: 90, length: 300 }));
    expect(line.dataset.orientation).toBe('vertical');
    expect(line.style.blockSize).toBe('300px');
    act(() => ref.current!.hide());
    expect(line.hidden).toBe(true);
  });
});
