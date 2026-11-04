import { useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDirection } from '../src/hooks';
import { CgFormLayoutGroup, CgRadioGroup, CgTabs } from '../src';
import type { CgDirection } from '../src';
import { directionControls } from '../src/stories/Direction.stories';

vi.mock('../src/vendor/rich-text-editor/editor.js', () => ({
  create: () => ({ setOptions: vi.fn(), command: vi.fn(), getLink: () => '', validateUrl: () => true, getHtml: () => '', flush: vi.fn(), focus: vi.fn(), dispose: vi.fn() }),
}));
vi.mock('../src/components/PdfViewer/pdfController.js', () => ({ create: vi.fn() }));

function Probe({ direction }: { direction?: CgDirection }) {
  const ref = useRef<HTMLDivElement>(null);
  const resolved = useDirection(ref, direction);
  return <div ref={ref} data-testid="probe" dir={resolved}>{resolved}</div>;
}

afterEach(() => { document.documentElement.removeAttribute('dir'); });

describe('useDirection', () => {
  it('follows an RTL parent even though the element writes its own dir', () => {
    render(<section dir="rtl"><Probe /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'rtl');
  });

  it('follows an LTR parent inside an RTL document', () => {
    document.documentElement.dir = 'rtl';
    render(<section dir="ltr"><Probe /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'ltr');
  });

  it('is LTR with no dir on any ancestor', () => {
    render(<section><Probe /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'ltr');
  });

  it('falls back to the document with no dir on a closer ancestor', () => {
    document.documentElement.dir = 'rtl';
    render(<section><Probe /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'rtl');
  });

  it('lets an explicit direction win over the parent', () => {
    const { rerender } = render(<section dir="rtl"><Probe direction="ltr" /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'ltr');
    rerender(<section dir="ltr"><Probe direction="rtl" /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'rtl');
  });

  it('returns to the parent when an explicit direction goes back to auto', () => {
    const { rerender } = render(<section dir="rtl"><Probe direction="ltr" /></section>);
    rerender(<section dir="rtl"><Probe direction="auto" /></section>);
    expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'rtl');
  });

  it('follows the parent both ways when its dir changes later', async () => {
    const { container } = render(<section dir="ltr"><Probe /></section>);
    const parent = container.querySelector('section')!;
    parent.dir = 'rtl';
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'rtl'));
    parent.dir = 'ltr';
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'ltr'));
  });

  it('settles a nested control when its parent control resolves after it', async () => {
    function Outer() {
      const ref = useRef<HTMLDivElement>(null);
      const resolved = useDirection(ref);
      return <div ref={ref} data-testid="outer" dir={resolved}><Probe /></div>;
    }
    render(<section dir="rtl"><Outer /></section>);
    expect(screen.getByTestId('outer')).toHaveAttribute('dir', 'rtl');
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveAttribute('dir', 'rtl'));
  });
});

describe('controls that write their own dir', () => {
  const rootOf = (parent: HTMLElement) => parent.firstElementChild;

  it.each(directionControls.map((control) => [control.name, control] as const))('%s follows its parent both ways', async (_name, control) => {
    const { unmount } = render(<div dir="rtl" data-testid="parent">{control.render()}</div>);
    await waitFor(() => expect(rootOf(screen.getByTestId('parent'))).toHaveAttribute('dir', 'rtl'));
    unmount();
    document.documentElement.dir = 'rtl';
    render(<div dir="ltr" data-testid="parent">{control.render()}</div>);
    await waitFor(() => expect(rootOf(screen.getByTestId('parent'))).toHaveAttribute('dir', 'ltr'));
    await act(async () => { await Promise.resolve(); });
  });

  it.each(directionControls.map((control) => [control.name, control] as const))('%s keeps an explicit direction over its parent', async (_name, control) => {
    render(<div dir="rtl" data-testid="parent">{control.render('ltr')}</div>);
    await waitFor(() => expect(rootOf(screen.getByTestId('parent'))).toHaveAttribute('dir', 'ltr'));
    await act(async () => { await Promise.resolve(); });
  });

  it('a form group outside a form layout leaves direction to its parent', () => {
    const { container } = render(<div dir="rtl"><CgFormLayoutGroup caption="المجموعة"><CgTabs tabs={[{ key: 'one', text: 'عام', content: 'عام' }]} /></CgFormLayoutGroup></div>);
    expect(container.querySelector('section')).not.toHaveAttribute('dir');
    expect(screen.getByRole('tablist').closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });
});

describe('CgRadioGroup', () => {
  const options = [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }];

  it.each([
    ['an inherited', <div key="parent" dir="rtl"><CgRadioGroup legend="Group" orientation="horizontal" options={options} defaultValue="one" /></div>],
    ['its own native', <CgRadioGroup key="native" dir="rtl" legend="Group" orientation="horizontal" options={options} defaultValue="one" />],
  ])('mirrors arrow keys under %s RTL direction', (_label, element) => {
    render(element);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'One' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Two' })).toBeChecked();
  });
});
