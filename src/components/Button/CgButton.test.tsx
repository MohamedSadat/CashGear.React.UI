import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgButton } from './CgButton';

describe('CgButton', () => {
  describe('rendering', () => {
    it('renders its children as an accessible button', () => {
      render(<CgButton>Post Invoice</CgButton>);
      expect(screen.getByRole('button', { name: 'Post Invoice' })).toBeInTheDocument();
    });

    it('defaults to type="button" so it never submits a form by accident', () => {
      render(<CgButton>Search</CgButton>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('honours an explicit type', () => {
      render(<CgButton type="submit">Save</CgButton>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('props', () => {
    it('merges a consumer className with its own classes', () => {
      render(<CgButton className="toolbar-item">Save</CgButton>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('toolbar-item');
      expect(button.className.split(' ').length).toBeGreaterThan(1);
    });

    it('applies distinct classes per variant and size', () => {
      const { rerender } = render(
        <CgButton variant="primary" size="sm">
          A
        </CgButton>,
      );
      const primarySmall = screen.getByRole('button').className;

      rerender(
        <CgButton variant="danger" size="lg">
          A
        </CgButton>,
      );
      expect(screen.getByRole('button').className).not.toBe(primarySmall);
    });

    it('forwards unknown native attributes to the underlying button', () => {
      render(
        <CgButton form="invoice-form" name="post" data-testid="post-btn">
          Post
        </CgButton>,
      );
      const button = screen.getByTestId('post-btn');
      expect(button).toHaveAttribute('form', 'invoice-form');
      expect(button).toHaveAttribute('name', 'post');
    });

    it('renders decorative icons hidden from assistive technology', () => {
      render(
        <CgButton iconBefore={<span data-testid="icon">+</span>}>New</CgButton>,
      );
      // The accessible name must stay the label alone.
      expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
      expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('events', () => {
    it('calls onClick when activated with the mouse', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<CgButton onClick={onClick}>Refresh</CgButton>);

      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('is reachable and activatable from the keyboard', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<CgButton onClick={onClick}>Refresh</CgButton>);

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();

      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('disabled behaviour', () => {
    it('sets the disabled attribute and fires no click events', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <CgButton disabled onClick={onClick}>
          Delete
        </CgButton>,
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();

      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('is removed from the tab order when disabled', async () => {
      const user = userEvent.setup();
      render(<CgButton disabled>Delete</CgButton>);

      await user.tab();
      expect(screen.getByRole('button')).not.toHaveFocus();
    });

    it('blocks clicks while loading without dropping out of the tab order', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <CgButton loading onClick={onClick}>
          Saving
        </CgButton>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();

      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('exposes an accessible name from its children', () => {
      render(<CgButton>Export to Excel</CgButton>);
      expect(screen.getByRole('button')).toHaveAccessibleName('Export to Excel');
    });

    it('lets consumers override the accessible name with aria-label', () => {
      render(<CgButton aria-label="Close dialog">×</CgButton>);
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    });

    it('sets no aria-busy when idle', () => {
      render(<CgButton>Idle</CgButton>);
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
    });
  });

  describe('ref forwarding', () => {
    it('forwards the ref to the underlying button element', () => {
      const ref = createRef<HTMLButtonElement>();
      render(<CgButton ref={ref}>Focus me</CgButton>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });
});
