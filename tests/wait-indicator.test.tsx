import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CgLoadingPanel, CgWaitIndicator } from '../src';

describe('CgWaitIndicator', () => {
  it('announces once and renders every visual and size', () => {
    const view = render(<CgWaitIndicator />);
    const status = screen.getByRole('status', { name: 'Loading' });
    expect(status.querySelector('[data-cg-wait-animation="spinner"]')).toBeInTheDocument();
    view.rerender(<CgWaitIndicator animation="dots" size="small" ariaLabel="Working" />);
    expect(screen.getByRole('status', { name: 'Working' }).querySelectorAll('i')).toHaveLength(3);
    view.rerender(<CgWaitIndicator animation="pulse" size="large" />);
    expect(screen.getByRole('status').querySelector('[data-cg-wait-animation="pulse"]')).toBeInTheDocument();
  });

  it('supports decorative, custom, hidden, and native states', () => {
    const ref = createRef<HTMLSpanElement>();
    const view = render(<CgWaitIndicator ref={ref} decorative data-testid="wait" title="Working"><strong>Custom progress</strong></CgWaitIndicator>);
    expect(screen.getByTestId('wait')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Custom progress')).toBeInTheDocument();
    expect(ref.current).toHaveAttribute('title', 'Working');
    view.rerender(<CgWaitIndicator visible={false} />);
    expect(screen.queryByTestId('wait')).not.toBeInTheDocument();
  });

  it('shares the wait visual with LoadingPanel and rejects invalid enums', () => {
    render(<CgLoadingPanel visible mode="inline" indicator="dots" />);
    expect(screen.getByRole('status').querySelector('[data-cg-wait-animation="dots"]')).toBeInTheDocument();
    expect(() => render(<CgWaitIndicator animation={'bad' as 'spinner'} />)).toThrow(/animation/u);
  });
});
