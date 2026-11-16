import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgDrawer, CgFlyout, CgSplitter, CgTabs } from '../src';
import type { CgFlyoutActions, CgSplitterPaneDescriptor } from '../src';
import { parseDrawerLength } from '../src/components/Drawer/drawerState';

describe('CgSplitter fixes', () => {
  const panes: ReadonlyArray<CgSplitterPaneDescriptor> = [
    { key: 'nav', ariaLabel: 'التنقل', renderHeader: () => 'الصفحات', renderContent: () => 'قائمة' },
    { key: 'main', ariaLabel: 'المحتوى', renderContent: () => 'المستند' },
  ];

  it('names each separator through separatorAriaLabel, given the panes on either side', () => {
    const label = vi.fn(({ start, end }: { start: CgSplitterPaneDescriptor; end: CgSplitterPaneDescriptor }) => `تغيير حجم ${start.ariaLabel!} و${end.ariaLabel!}`);
    render(<CgSplitter aria-label="تخطيط" panes={panes} separatorAriaLabel={label} />);
    expect(screen.getByRole('separator', { name: 'تغيير حجم التنقل والمحتوى' })).toBeInTheDocument();
    expect(label).toHaveBeenCalledWith({ start: panes[0], end: panes[1] });
  });

  it('keeps its English separator name when none is given', () => {
    render(<CgSplitter aria-label="Layout" panes={panes} />);
    expect(screen.getByRole('separator', { name: 'Resize التنقل and المحتوى' })).toBeInTheDocument();
  });

  it('lays a pane out as a column whose content fills it and scrolls under a fixed header', () => {
    render(<CgSplitter aria-label="تخطيط" panes={panes} />);
    const pane = screen.getByRole('region', { name: 'التنقل' });
    const content = screen.getByText('قائمة');
    expect(getComputedStyle(pane).display).toBe('flex');
    expect(getComputedStyle(pane).flexDirection).toBe('column');
    expect(getComputedStyle(pane).overflow).toBe('hidden');
    expect(getComputedStyle(content).overflow).toBe('auto');
    expect(getComputedStyle(content).flexGrow).toBe('1');
    expect(getComputedStyle(screen.getByText('الصفحات')).flexShrink).toBe('0');
  });
});

describe('CgDrawer fixes', () => {
  it('takes a CSS math function as a size and keeps it as written', () => {
    expect(parseDrawerLength('min(20rem, 90vw)', 'openSize', '20rem')).toMatchObject({ unit: 'expression', css: 'min(20rem, 90vw)' });
    expect(parseDrawerLength('clamp(12rem, 30%, 24rem)', 'openSize', '20rem').css).toBe('clamp(12rem, 30%, 24rem)');
    expect(parseDrawerLength('calc(100% - 2rem)', 'openSize', '20rem').css).toBe('calc(100% - 2rem)');
    const { container } = render(<CgDrawer aria-label="التنقل" defaultOpen openSize="min(16rem, 40%)" miniSize="4rem" />);
    const root = container.querySelector<HTMLElement>('[style*="--cg-drawer-size"]')!;
    expect(root.style.getPropertyValue('--cg-drawer-size')).toBe('min(16rem, 40%)');
  });

  it('still refuses text that is not a length or a safe math function', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const size of ['min(20rem', 'min(20rem;color:red)', 'url(x)', 'var(--x)', 'min(1px) min(2px)', 'calc(1px))']) {
      expect(() => parseDrawerLength(size, 'openSize', '20rem'), size).toThrow(/CSS length/u);
    }
  });
});

describe('CgTabs fixes', () => {
  const tabs = [{ key: 'a', text: 'أ', content: 'لوحة أ' }, { key: 'b', text: 'ب', content: 'لوحة ب' }];

  it('takes no pointer capture on a press, so the click reaches the tab', () => {
    const changed = vi.fn();
    render(<CgTabs aria-label="عروض" tabs={tabs} defaultActiveKey="a" reorderable onActiveKeyChange={changed} />);
    const tab = screen.getByRole('tab', { name: 'ب' });
    const wrapper = tab.parentElement!;
    const capture = vi.fn();
    wrapper.setPointerCapture = capture;
    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerUp(tab, { pointerId: 1, button: 0, clientX: 10, clientY: 10, pointerType: 'mouse' });
    fireEvent.click(tab);
    expect(capture).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledWith('b', expect.anything());
  });

  it('captures the pointer once a drag passes its threshold, and forgets a press released elsewhere', () => {
    render(<CgTabs aria-label="عروض" tabs={tabs} defaultActiveKey="a" reorderable />);
    const wrapper = screen.getByRole('tab', { name: 'أ' }).parentElement!;
    const capture = vi.fn();
    wrapper.setPointerCapture = capture;
    fireEvent.pointerDown(wrapper, { pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerMove(wrapper, { pointerId: 1, buttons: 1, clientX: 30, clientY: 10, pointerType: 'mouse' });
    expect(capture).toHaveBeenCalledWith(1);
    capture.mockClear();
    fireEvent.pointerUp(wrapper, { pointerId: 1, clientX: 30, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerDown(wrapper, { pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerMove(wrapper, { pointerId: 1, buttons: 0, clientX: 40, clientY: 10, pointerType: 'mouse' });
    fireEvent.pointerMove(wrapper, { pointerId: 1, buttons: 1, clientX: 60, clientY: 10, pointerType: 'mouse' });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('CgFlyout fixes', () => {
  it('focuses its first control on opening with autoFocus', () => {
    const { rerender } = render(<><button type="button">قبل</button><CgFlyout anchor={{ x: 10, y: 10 }} open={false} autoFocus><input aria-label="الاسم" /></CgFlyout></>);
    rerender(<><button type="button">قبل</button><CgFlyout anchor={{ x: 10, y: 10 }} open autoFocus><input aria-label="الاسم" /></CgFlyout></>);
    expect(document.querySelector('input[aria-label="الاسم"]')).toHaveFocus();
  });

  it('focuses from onAfterOpen when mounted open', () => {
    const actions = createRef<CgFlyoutActions>();
    render(<CgFlyout anchor={{ x: 10, y: 10 }} open actionsRef={actions} onAfterOpen={() => actions.current?.focusFirst()}><button type="button" data-cg-initial-focus="">حفظ</button></CgFlyout>);
    expect(screen.getByText('حفظ')).toHaveFocus();
  });

  it('watches the document for its anchor only while open', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const anchor = document.createElement('button');
    document.body.append(anchor);
    const { rerender, unmount } = render(<CgFlyout anchor={anchor} open={false}>محتوى</CgFlyout>);
    expect(observe).not.toHaveBeenCalled();
    rerender(<CgFlyout anchor={anchor} open>محتوى</CgFlyout>);
    expect(observe).toHaveBeenCalledWith(document.documentElement, { childList: true, subtree: true });
    const disconnectsWhileOpen = disconnect.mock.calls.length;
    rerender(<CgFlyout anchor={anchor} open={false}>محتوى</CgFlyout>);
    expect(disconnect.mock.calls.length).toBeGreaterThan(disconnectsWhileOpen);
    observe.mockClear();
    act(() => { document.body.append(document.createElement('div')); });
    expect(observe).not.toHaveBeenCalled();
    unmount();
    anchor.remove();
  });

  it('keeps an explicit width through positioning', () => {
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => ({ x: 20, y: 20, left: 20, top: 20, right: 120, bottom: 50, width: 100, height: 30, toJSON: () => ({}) });
    document.body.append(anchor);
    const scrollWidth = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(80);
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80);
    render(<CgFlyout anchor={anchor} open width={300} data-testid="surface">محتوى</CgFlyout>);
    const surface = screen.getByTestId('surface');
    expect(surface.style.position).toBe('fixed');
    expect(surface.style.width).toBe('300px');
    scrollWidth.mockRestore(); scrollHeight.mockRestore(); offsetWidth.mockRestore(); offsetHeight.mockRestore();
    anchor.remove();
  });
});

describe('Theme tokens', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');

  it('defines every --cg-color name a component reads, on every themed element', () => {
    const aliasBlock = /:root,\s*\[data-cg-theme\]\s*\{([^}]*)\}/u.exec(tokens)?.[1] ?? '';
    for (const name of ['text', 'text-muted', 'text-disabled', 'surface', 'surface-subtle', 'surface-raised', 'surface-muted', 'surface-hover', 'border', 'focus', 'danger', 'on-primary']) {
      expect(aliasBlock, name).toMatch(new RegExp(`--cg-color-${name}:`, 'u'));
    }
  });

  it('puts dark text on the dark theme\'s accents', () => {
    const dark = /\[data-cg-theme='dark'\]\s*\{([^}]*)\}/u.exec(tokens)?.[1] ?? '';
    expect(dark).toMatch(/--cg-color-fg-on-accent:\s*#0f141c/u);
    const button = readFileSync('src/components/Button/CgButton.module.css', 'utf8');
    expect(button).not.toMatch(/--button-color:\s*#fff/u);
  });
});

describe('Workspace editor follow-ups', () => {
  it('marks a toolbar item that opens a panel with aria-expanded and aria-controls', async () => {
    const { CgToolbar } = await import('../src');
    render(<CgToolbar ariaLabel="التنسيق" items={[{ name: 'link', text: 'رابط', icon: 'link', iconOnly: true, expanded: true, controls: 'link-panel' }, { name: 'bold', text: 'غامق', icon: 'text-bold', iconOnly: true }]} />);
    expect(screen.getByRole('button', { name: 'رابط' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'رابط' })).toHaveAttribute('aria-controls', 'link-panel');
    expect(screen.getByRole('button', { name: 'غامق' })).not.toHaveAttribute('aria-expanded');
  });

  it('draws no label box in an icon-only button', async () => {
    const { CgButton } = await import('../src');
    render(<CgButton icon="text-bold" aria-label="غامق">{null}</CgButton>);
    const label = screen.getByRole('button', { name: 'غامق' }).querySelector('span:last-child')!;
    expect(label).toBeEmptyDOMElement();
    expect(getComputedStyle(label).display).toBe('none');
  });

  it('gives the indent icons right-to-left drawings', async () => {
    const { fluentIconRtlPaths } = await import('../src/vendor/fluent-icons/icons');
    expect(fluentIconRtlPaths['indent-increase']).toMatch(/^[Mm]/u);
    expect(fluentIconRtlPaths['indent-decrease']).toMatch(/^[Mm]/u);
  });
});

describe('Workspace notices and sidebar actions', () => {
  it('draws a toast action as a link when it has an address, and still runs onAction', async () => {
    const { CgToastProvider, useCgToast } = await import('../src');
    const onAction = vi.fn();
    let show: ReturnType<typeof useCgToast>['show'] | undefined;
    function Capture() { show = useCgToast().show; return null; }
    render(<CgToastProvider><Capture /></CgToastProvider>);
    act(() => { show!({ content: 'استُعيدت الصفحة', persistent: true, action: { label: 'فتح الصفحة', href: '#/p/123', onAction } }); });
    const link = screen.getByRole('link', { name: 'فتح الصفحة' });
    expect(link).toHaveAttribute('href', '#/p/123');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => { link.dispatchEvent(click); });
    expect(click.defaultPrevented).toBe(false);
    expect(onAction).toHaveBeenCalledTimes(1);
    act(() => { show!({ content: 'في سلة المحذوفات', persistent: true, action: { label: 'سلة المحذوفات', href: 'https://example.test/trash', target: '_blank' } }); });
    expect(screen.getByRole('link', { name: 'سلة المحذوفات' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(() => act(() => { show!({ content: 'x', action: { label: 'y' } }); })).toThrow(/onAction or href/u);
  });

  it('keeps tree row actions out of the accessibility tree until the row is hovered or focused', async () => {
    const { CgTreeView } = await import('../src');
    render(<CgTreeView aria-label="الصفحات" nodes={[{ key: 'a', text: 'أ' }, { key: 'b', text: 'ب' }]} renderActions={(context) => <button type="button">إجراءات {String(context.text)}</button>} />);
    const actions = screen.getByText('إجراءات أ').parentElement!;
    expect(getComputedStyle(actions).visibility).toBe('hidden');
    expect(screen.queryByRole('button', { name: /إجراءات/u })).toBeNull();
  });
});
