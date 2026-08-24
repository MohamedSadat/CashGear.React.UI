import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgButton, CgField, CgIcon, CgTextBox } from '../src';

describe('CgIcon, CgButton, and CgField', () => {
  it('renders decorative and labelled currentColor icons with SVG attributes and refs', () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(<><CgIcon name="search" /><CgIcon ref={ref} name="chevron-end" label="Next" size={24} data-kind="logical" /></>);
    expect(container.querySelector('svg[aria-hidden="true"]')).toHaveAttribute('stroke', 'currentColor');
    expect(screen.getByRole('img', { name: 'Next' })).toHaveAttribute('width', '24');
    expect(ref.current).toHaveAttribute('data-kind', 'logical');
  });

  it('supports native button behavior, thenables, duplicate suppression, and rejection cleanup', async () => {
    let settle: (() => void) | undefined;
    const action = vi.fn(() => ({
      then: (resolve: () => void) => {
        settle = resolve;
      },
    }) as unknown as PromiseLike<void>);
    const ref = createRef<HTMLButtonElement>();
    render(<CgButton ref={ref} name="save" type="submit" intent="primary" loadingContent="Saving" onClick={action}>Save</CgButton>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(ref.current).toBe(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      await Promise.resolve();
      settle?.();
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-busy');

    const rejected = vi.fn(() => Promise.reject(new Error('expected')));
    render(<CgButton onClick={rejected}>Reject safely</CgButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Reject safely' }));
    await act(async () => Promise.resolve());
    expect(screen.getByRole('button', { name: 'Reject safely' })).not.toHaveAttribute('aria-busy');
  });

  it('does not update after an async button or editor command unmounts', () => {
    const pending = new Promise<void>(() => undefined);
    const buttonView = render(<CgButton onClick={() => pending}>Save</CgButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    buttonView.unmount();

    const editorView = render(<CgTextBox aria-label="Code" buttons={[{ key: 'run', text: 'Run', ariaLabel: 'Run command', onPress: () => pending }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    editorView.unmount();
  });

  it('composes required, disabled, read-only, validation, description, and message ARIA', () => {
    render(
      <CgField label="Account" description="Ledger code" required readOnly errorMessage="Required">
        <CgTextBox />
      </CgField>,
    );
    const input = screen.getByLabelText('Account *');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ledger code'));
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
