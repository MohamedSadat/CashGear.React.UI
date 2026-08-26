import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgFormLayout, CgFormLayoutGroup, CgFormLayoutItem, CgFormLayoutTabs, CgTextBox } from '../src';

describe('CgFormLayout', () => {
  it('resolves default and inherited responsive spans without inspecting children', () => {
    render(<CgFormLayout data-testid="layout"><CgFormLayoutItem data-testid="default" caption="Default"><CgTextBox /></CgFormLayoutItem><CgFormLayoutItem data-testid="late" caption="Late" lg={3}><CgTextBox /></CgFormLayoutItem><CgFormLayoutGroup data-testid="group" caption="Group"><span>Body</span></CgFormLayoutGroup></CgFormLayout>);
    expect(screen.getByTestId('layout')).toHaveStyle({ containerType: 'inline-size' });
    expect(screen.getByTestId('default').style.getPropertyValue('--cg-fl-xs')).toBe('12');
    expect(screen.getByTestId('default').style.getPropertyValue('--cg-fl-md')).toBe('6');
    expect(screen.getByTestId('late').style.getPropertyValue('--cg-fl-md')).toBe('12');
    expect(screen.getByTestId('late').style.getPropertyValue('--cg-fl-xl')).toBe('3');
    expect(screen.getByTestId('group').style.getPropertyValue('--cg-fl-xxl')).toBe('12');
  });

  it('uses native labels with captionFor and private caption context otherwise', () => {
    render(<CgFormLayout><CgFormLayoutItem caption="Native account" captionFor="native"><input id="native" /></CgFormLayoutItem><CgFormLayoutItem caption="React account"><CgTextBox /></CgFormLayoutItem></CgFormLayout>);
    expect(screen.getByRole('textbox', { name: 'Native account' })).toHaveAttribute('id', 'native');
    expect(screen.getByRole('textbox', { name: 'React account' })).toHaveAttribute('aria-labelledby');
  });

  it('applies accessible-name precedence: explicit label, explicit labelledby, CgField, then layout caption', () => {
    render(<CgFormLayout>
      <CgFormLayoutItem caption="Layout A"><CgTextBox aria-label="Explicit A" /></CgFormLayoutItem>
      <CgFormLayoutItem caption="Layout B"><span id="explicit-b">Explicit B</span><CgTextBox aria-labelledby="explicit-b" /></CgFormLayoutItem>
      <CgFormLayoutItem caption="Layout C"><CgField label="Field C"><CgTextBox /></CgField></CgFormLayoutItem>
      <CgFormLayoutItem caption="Layout D"><CgTextBox /></CgFormLayoutItem>
    </CgFormLayout>);
    expect(screen.getByRole('textbox', { name: 'Explicit A' })).not.toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('textbox', { name: 'Explicit B' })).toHaveAttribute('aria-labelledby', 'explicit-b');
    expect(screen.getByRole('textbox', { name: 'Field C' }).getAttribute('aria-labelledby')).toMatch(/-label$/);
    expect(screen.getByRole('textbox', { name: 'Layout D' })).toBeInTheDocument();
  });

  it('keeps collapsed group bodies mounted, hidden, and controlled state authoritative', async () => {
    const changed = vi.fn(); const after = vi.fn();
    render(<CgFormLayout><CgFormLayoutGroup caption="Options" collapsible expanded={false} onExpandedChange={changed} afterExpandedChange={after}><input aria-label="Retained option" defaultValue="kept" /></CgFormLayoutGroup></CgFormLayout>);
    const body = screen.getByText('Options').closest('section')!.querySelector('[id$="-content"]');
    expect(body).toHaveAttribute('hidden');
    expect(screen.getByRole('textbox', { name: 'Retained option', hidden: true })).toHaveValue('kept');
    await userEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(changed).toHaveBeenCalledWith(true, expect.objectContaining({ isUserInitiated: true }));
    expect(body).toHaveAttribute('hidden');
    expect(after).not.toHaveBeenCalled();
  });

  it('uses retained on-demand descriptor tabs and a fresh nested grid per panel', async () => {
    render(<CgFormLayout direction="rtl"><CgFormLayoutTabs tabs={[{ key: 'one', text: 'One', content: <CgFormLayoutItem caption="First"><CgTextBox aria-label="First value" defaultValue="kept" /></CgFormLayoutItem> }, { key: 'two', text: 'Two', captionPosition: 'horizontal', content: <CgFormLayoutItem caption="Second"><CgTextBox /></CgFormLayoutItem> }]} /></CgFormLayout>);
    await userEvent.type(screen.getByRole('textbox', { name: 'First value' }), ' value');
    await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByRole('textbox', { name: 'Second' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'One' }));
    expect(screen.getByRole('textbox', { name: 'First value' })).toHaveValue('kept value');
    expect(screen.getByRole('tablist').closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });

  it('rejects invalid spans and inaccessible collapsible groups', () => {
    expect(() => render(<CgFormLayout><CgFormLayoutItem xs={0 as 1}>X</CgFormLayoutItem></CgFormLayout>)).toThrow(/span must be an integer/);
    expect(() => render(<CgFormLayout><CgFormLayoutGroup collapsible>Body</CgFormLayoutGroup></CgFormLayout>)).toThrow(/accessible caption/);
  });

  it('renders deterministic SSR markup and hydrates without changing ids', async () => {
    const content = <CgFormLayout><CgFormLayoutItem caption="Hydrated"><CgTextBox defaultValue="value" /></CgFormLayoutItem></CgFormLayout>;
    const html = renderToString(content); const container = document.createElement('div'); container.innerHTML = html;
    const before = container.querySelector('input')?.getAttribute('aria-labelledby');
    await act(async () => { hydrateRoot(container, content); await Promise.resolve(); });
    expect(container.querySelector('input')?.getAttribute('aria-labelledby')).toBe(before);
  });
});
