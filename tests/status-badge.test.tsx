import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgStatusBadge } from '../src/components/StatusBadge';

describe('CgStatusBadge', () => {
  it.each(['neutral', 'info', 'success', 'warning', 'error'] as const)('renders the %s semantic type class', (type) => {
    render(<CgStatusBadge type={type}>State</CgStatusBadge>);
    expect(screen.getByText('State').closest('[data-cg-status-badge]')).toHaveAttribute('data-type', type);
  });

  it.each(['soft', 'solid', 'outline'] as const)('renders the %s appearance', (appearance) => {
    render(<CgStatusBadge appearance={appearance}>State</CgStatusBadge>);
    expect(screen.getByText('State').closest('[data-cg-status-badge]')).toHaveAttribute('data-appearance', appearance);
  });

  it('uses children and renderIcon precedence with decorative icon and indicator semantics', () => {
    render(<CgStatusBadge text="Fallback" icon="check" renderIcon={() => <span data-custom-icon="">Custom</span>} indicator><strong>Rich</strong></CgStatusBadge>);
    expect(screen.getByText('Rich')).toBeInTheDocument();
    expect(screen.queryByText('Fallback')).not.toBeInTheDocument();
    expect(document.querySelector('[data-custom-icon]')?.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('[class*="indicator"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds no role by default and permits explicit live-region roles and names', () => {
    const { rerender } = render(<CgStatusBadge data-testid="badge">State</CgStatusBadge>);
    expect(screen.getByTestId('badge')).not.toHaveAttribute('role');
    rerender(<CgStatusBadge role="status" accessibleLabel="Import state" data-testid="badge">Complete</CgStatusBadge>);
    expect(screen.getByRole('status', { name: 'Import state' })).toBeInTheDocument();
  });

  it('dismisses once, observes async rejection, and never restores on failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dismiss = vi.fn(() => Promise.reject(new Error('nope')));
    render(<CgStatusBadge dismissible onDismiss={dismiss}>Dismiss me</CgStatusBadge>);
    const button = screen.getByRole('button', { name: 'Dismiss status' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    error.mockRestore();
  });

  it('re-arms only after visible transitions from false to true', () => {
    const { rerender } = render(<CgStatusBadge dismissible visible>State</CgStatusBadge>);
    fireEvent.click(screen.getByRole('button'));
    rerender(<CgStatusBadge dismissible visible>State</CgStatusBadge>);
    expect(screen.queryByText('State')).not.toBeInTheDocument();
    rerender(<CgStatusBadge dismissible visible={false}>State</CgStatusBadge>);
    rerender(<CgStatusBadge dismissible visible>State</CgStatusBadge>);
    expect(screen.getByText('State')).toBeInTheDocument();
  });

  it('merges safe span attributes and produces deterministic SSR/Strict Mode markup', () => {
    const html = renderToString(<CgStatusBadge id="server" className="consumer" size="large" shape="pill">Ready</CgStatusBadge>);
    expect(html).toContain('id="server"');
    expect(html).toContain('data-size="large"');
    render(<StrictMode><CgStatusBadge data-testid="strict">Ready</CgStatusBadge></StrictMode>);
    expect(screen.getByTestId('strict')).toHaveTextContent('Ready');
  });
});
