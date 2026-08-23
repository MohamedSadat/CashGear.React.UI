import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgTextBox } from './CgTextBox';

describe('CgTextBox', () => {
  describe('rendering', () => {
    it('renders a labelled textbox wired to the input', () => {
      render(<CgTextBox label="Customer code" />);
      const input = screen.getByLabelText('Customer code');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('generates a unique id per instance when none is supplied', () => {
      render(
        <>
          <CgTextBox label="First" />
          <CgTextBox label="Second" />
        </>,
      );
      const first = screen.getByLabelText('First');
      const second = screen.getByLabelText('Second');
      expect(first.id).toBeTruthy();
      expect(first.id).not.toBe(second.id);
    });

    it('uses a supplied id verbatim', () => {
      render(<CgTextBox label="Code" id="customer-code" />);
      expect(screen.getByLabelText('Code')).toHaveAttribute('id', 'customer-code');
    });

    it('renders prefix and suffix affixes hidden from assistive technology', () => {
      render(
        <CgTextBox
          label="Amount"
          prefix={<span data-testid="prefix">$</span>}
          suffix={<span data-testid="suffix">USD</span>}
        />,
      );
      expect(screen.getByTestId('prefix').parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('suffix').parentElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('props', () => {
    it('defaults to type="text" and honours an explicit type', () => {
      const { rerender } = render(<CgTextBox label="A" />);
      expect(screen.getByLabelText('A')).toHaveAttribute('type', 'text');

      rerender(<CgTextBox label="A" type="search" />);
      expect(screen.getByLabelText('A')).toHaveAttribute('type', 'search');
    });

    it('forwards native attributes such as placeholder and maxLength', () => {
      render(<CgTextBox label="Code" placeholder="ACME-001" maxLength={10} />);
      const input = screen.getByLabelText('Code');
      expect(input).toHaveAttribute('placeholder', 'ACME-001');
      expect(input).toHaveAttribute('maxlength', '10');
    });

    it('renders a helper message described by the input', () => {
      render(<CgTextBox label="Code" message="Up to 10 characters" />);
      expect(screen.getByLabelText('Code')).toHaveAccessibleDescription('Up to 10 characters');
    });

    it('merges a consumer className onto the root', () => {
      render(<CgTextBox label="Code" className="form-cell" data-testid="tb" />);
      expect(screen.getByTestId('tb').className).toContain('form-cell');
    });
  });

  describe('uncontrolled and controlled value', () => {
    it('manages its own value when only defaultValue is given', async () => {
      const user = userEvent.setup();
      render(<CgTextBox label="Code" defaultValue="AC" />);

      const input = screen.getByLabelText<HTMLInputElement>('Code');
      expect(input.value).toBe('AC');

      await user.type(input, 'ME');
      expect(input.value).toBe('ACME');
    });

    it('does not change value on its own when controlled', async () => {
      const user = userEvent.setup();
      render(<CgTextBox label="Code" value="LOCKED" onValueChange={vi.fn()} />);

      const input = screen.getByLabelText<HTMLInputElement>('Code');
      await user.type(input, 'X');
      expect(input.value).toBe('LOCKED');
    });

    it('updates when the controlling component supplies a new value', async () => {
      const user = userEvent.setup();

      function Host() {
        const [value, setValue] = useState('');
        return <CgTextBox label="Code" value={value} onValueChange={setValue} />;
      }

      render(<Host />);
      const input = screen.getByLabelText<HTMLInputElement>('Code');
      await user.type(input, 'ACME');
      expect(input.value).toBe('ACME');
    });
  });

  describe('events', () => {
    it('calls onValueChange with the current string value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<CgTextBox label="Code" onValueChange={onValueChange} />);

      await user.type(screen.getByLabelText('Code'), 'AB');

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange).toHaveBeenLastCalledWith('AB', expect.anything());
    });

    it('calls the native onChange alongside onValueChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(<CgTextBox label="Code" onChange={onChange} onValueChange={onValueChange} />);

      await user.type(screen.getByLabelText('Code'), 'A');
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('fires focus and blur handlers', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      render(<CgTextBox label="Code" onFocus={onFocus} onBlur={onBlur} />);

      await user.click(screen.getByLabelText('Code'));
      expect(onFocus).toHaveBeenCalledTimes(1);

      await user.tab();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled and read-only behaviour', () => {
    it('does not accept input or fire change events when disabled', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<CgTextBox label="Code" disabled defaultValue="AC" onValueChange={onValueChange} />);

      const input = screen.getByLabelText<HTMLInputElement>('Code');
      expect(input).toBeDisabled();

      await user.type(input, 'ME');
      expect(input.value).toBe('AC');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('is removed from the tab order when disabled', async () => {
      const user = userEvent.setup();
      render(<CgTextBox label="Code" disabled />);

      await user.tab();
      expect(screen.getByLabelText('Code')).not.toHaveFocus();
    });

    it('stays focusable but not editable when read-only', async () => {
      const user = userEvent.setup();
      render(<CgTextBox label="Code" readOnly defaultValue="AC" />);

      const input = screen.getByLabelText<HTMLInputElement>('Code');
      await user.tab();
      expect(input).toHaveFocus();

      await user.type(input, 'ME');
      expect(input.value).toBe('AC');
    });
  });

  describe('accessibility', () => {
    it('marks the field invalid and announces the error message', () => {
      render(<CgTextBox label="Code" validationState="error" message="Code is required" />);

      const input = screen.getByLabelText('Code');
      const error = screen.getByRole('alert');

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-errormessage', error.id);
      expect(error).toHaveTextContent('Code is required');
    });

    it('is not marked invalid in the default state', () => {
      render(<CgTextBox label="Code" />);
      expect(screen.getByLabelText('Code')).not.toHaveAttribute('aria-invalid');
    });

    it('reflects the required state to assistive technology', () => {
      render(<CgTextBox label="Code" required />);
      const input = screen.getByLabelText('Code');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('supports aria-label when no visible label is rendered', () => {
      render(<CgTextBox aria-label="Quick search" />);
      expect(screen.getByRole('textbox', { name: 'Quick search' })).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('forwards the ref to the underlying input element', () => {
      const ref = createRef<HTMLInputElement>();
      render(<CgTextBox label="Code" ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });
});
