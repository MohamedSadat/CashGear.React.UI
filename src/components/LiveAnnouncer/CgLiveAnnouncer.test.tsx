import { act, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgLiveAnnouncer } from './CgLiveAnnouncer';
import type { CgLiveAnnouncerHandle } from './CgLiveAnnouncer.types';

const nextFrame = () => act(() => new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); }));

describe('CgLiveAnnouncer', () => {
  it('is a polite, atomic status region by default and an alert when assertive', () => {
    const { rerender } = render(<CgLiveAnnouncer data-testid="live" />);
    const region = screen.getByTestId('live');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();
    rerender(<CgLiveAnnouncer data-testid="live" politeness="assertive" />);
    expect(screen.getByTestId('live')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('live')).toHaveAttribute('aria-live', 'assertive');
  });

  it('writes the message a frame after emptying the region, so a repeat is read again', async () => {
    const ref = createRef<CgLiveAnnouncerHandle>();
    render(<CgLiveAnnouncer ref={ref} data-testid="live" />);
    const region = screen.getByTestId('live');
    act(() => ref.current!.announce('نُقلت البطاقة إلى «قيد التنفيذ»'));
    expect(region).toBeEmptyDOMElement();
    await nextFrame();
    expect(region).toHaveTextContent('نُقلت البطاقة إلى «قيد التنفيذ»');
    act(() => ref.current!.announce('نُقلت البطاقة إلى «قيد التنفيذ»'));
    expect(region).toBeEmptyDOMElement();
    await nextFrame();
    expect(region).toHaveTextContent('نُقلت البطاقة إلى «قيد التنفيذ»');
  });

  it('keeps only the last of several messages sent in one frame', async () => {
    const ref = createRef<CgLiveAnnouncerHandle>();
    render(<CgLiveAnnouncer ref={ref} data-testid="live" />);
    act(() => { ref.current!.announce('الأول'); ref.current!.announce('الثاني'); });
    await nextFrame();
    expect(screen.getByTestId('live')).toHaveTextContent(/^الثاني$/u);
  });

  it('never re-renders its owner when announcing', async () => {
    const ref = createRef<CgLiveAnnouncerHandle>();
    const renders = vi.fn();
    function Owner() { renders(); const [label] = useState('x'); return <div>{label}<CgLiveAnnouncer ref={ref} /></div>; }
    render(<Owner />);
    const before = renders.mock.calls.length;
    act(() => ref.current!.announce('رسالة'));
    await nextFrame();
    expect(renders.mock.calls.length).toBe(before);
  });

  it('clears after the given delay, on clear(), and on a blank message', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    const ref = createRef<CgLiveAnnouncerHandle>();
    render(<CgLiveAnnouncer ref={ref} clearAfter={1000} data-testid="live" />);
    const region = screen.getByTestId('live');
    act(() => { ref.current!.announce('تم الحفظ'); vi.advanceTimersByTime(20); });
    expect(region).toHaveTextContent('تم الحفظ');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(region).toBeEmptyDOMElement();
    act(() => { ref.current!.announce('مرة أخرى'); vi.advanceTimersByTime(20); });
    expect(region).toHaveTextContent('مرة أخرى');
    act(() => ref.current!.clear());
    expect(region).toBeEmptyDOMElement();
    act(() => { ref.current!.announce('ثالثة'); ref.current!.announce('   '); vi.advanceTimersByTime(20); });
    expect(region).toBeEmptyDOMElement();
  });

  it('rejects a clearAfter that is not a positive number', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgLiveAnnouncer clearAfter={0} />)).toThrow(RangeError);
  });

  it('cancels a pending message when unmounted', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    const ref = createRef<CgLiveAnnouncerHandle>();
    const { unmount } = render(<CgLiveAnnouncer ref={ref} />);
    const handle = ref.current!;
    act(() => handle.announce('رسالة'));
    unmount();
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
  });
});
