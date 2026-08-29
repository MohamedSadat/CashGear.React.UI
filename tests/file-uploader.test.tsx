import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgFileUploader } from '../src/components/FileUploader';
import type { CgFileUploaderActions, CgFileUploaderProps, CgStoredFile } from '../src/components/FileUploader';

const stored = (id: string, name = `${id}.pdf`): CgStoredFile => ({ id, location: `/files/${id}`, name, size: 10, contentType: 'application/pdf', metadata: {} });
const choose = (input: HTMLElement, files: File[]) => fireEvent.change(input, { target: { files } });

describe('CgFileUploader', () => {
  it('requires exactly one transport and validates queue settings', () => {
    expect(() => render(<CgFileUploader {...({} as unknown as CgFileUploaderProps)} />)).toThrow(/exactly one/u);
    expect(() => render(<CgFileUploader {...({ upload: async () => ({ succeeded: true as const }), uploadEndpoint: '/upload' } as unknown as CgFileUploaderProps)} />)).toThrow(/exactly one/u);
    expect(() => render(<CgFileUploader upload={async () => ({ succeeded: true })} maxFileCount={0} />)).toThrow(/maxFileCount/u);
    expect(() => render(<CgFileUploader upload={async () => ({ succeeded: true })} maxConcurrentUploads={0} />)).toThrow(/maxConcurrentUploads/u);
    expect(() => render(<CgFileUploader upload={async () => ({ succeeded: true })} maxFileCount={1} defaultStoredFiles={[stored('one'), stored('two')]} />)).toThrow(/defaultStoredFiles/u);
    expect(() => render(<CgFileUploader upload={async () => ({ succeeded: true })} defaultStoredFiles={[{ ...stored('bad'), size: -1 }]} />)).toThrow(/invalid stored file/u);
  });

  it('selects, uploads, reports immutable snapshots, and serializes durable IDs', async () => {
    const itemsChanged = vi.fn();
    const submitted = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submitted(new FormData(event.currentTarget).getAll('attachment')); }}>
      <CgFileUploader name="attachment" upload={async ({ reportProgress, file }) => { reportProgress(55); return { succeeded: true, storedFile: stored('stored-1', file.name) }; }} onItemsChange={itemsChanged} />
      <button type="submit">Submit</button>
    </form>);
    choose(screen.getByLabelText('Select files to upload'), [new File(['invoice'], 'invoice.pdf', { type: 'application/pdf', lastModified: 10 })]);
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeInTheDocument());
    const latest = itemsChanged.mock.calls.at(-1)?.[0] as ReadonlyArray<unknown>;
    expect(Object.isFrozen(latest)).toBe(true);
    expect(Object.isFrozen(latest[0]!)).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(submitted).toHaveBeenCalledWith(['stored-1']);
  });

  it('supports manual upload, bounded concurrency, expected failures, and retry', async () => {
    let active = 0; let peak = 0; let failOnce = true;
    const upload = vi.fn(async ({ file }: { file: File }) => {
      active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1;
      if (file.name === 'retry.txt' && failOnce) { failOnce = false; return { succeeded: false as const, errorMessage: 'Storage rejected the file.' }; }
      return { succeeded: true as const, storedFile: stored(file.name) };
    });
    render(<CgFileUploader upload={upload} autoUpload={false} maxConcurrentUploads={2} />);
    choose(screen.getByLabelText('Select files to upload'), [new File(['a'], 'a.txt'), new File(['b'], 'b.txt'), new File(['r'], 'retry.txt')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(screen.getByText('Storage rejected the file.')).toBeInTheDocument());
    expect(peak).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: 'Retry retry.txt' }));
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(3));
  });

  it('rejects count, size, and extension violations without uploading them', async () => {
    const upload = vi.fn(async () => ({ succeeded: true as const }));
    const rejected = vi.fn();
    render(<CgFileUploader upload={upload} autoUpload={false} maxFileCount={2} maxFileSize={3} allowedExtensions={['.pdf']} onFileRejected={rejected} />);
    choose(screen.getByLabelText('Select files to upload'), [
      new File(['ok'], 'ok.pdf'), new File(['large'], 'large.pdf'), new File(['no'], 'bad.txt'), new File(['x'], 'extra.pdf'),
      new File(['last'], 'last.pdf'),
    ]);
    await waitFor(() => expect(rejected).toHaveBeenCalledTimes(3));
    expect(screen.getByText(/larger than/u)).toBeInTheDocument();
    expect(screen.getByText(/Only .pdf/u)).toBeInTheDocument();
    expect(screen.getByText(/at most 2/u)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('cancels active handler work once and ignores its stale completion', async () => {
    let release: (() => void) | undefined;
    const cancelled = vi.fn();
    render(<CgFileUploader upload={({ signal }) => new Promise((resolve, reject) => {
      release = () => resolve({ succeeded: true, storedFile: stored('late') });
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    })} onUploadCancelled={cancelled} />);
    choose(screen.getByLabelText('Select files to upload'), [new File(['slow'], 'slow.txt')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel slow.txt' }));
    await waitFor(() => expect(screen.getByText('Cancelled')).toBeInTheDocument());
    release?.();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Uploaded')).not.toBeInTheDocument();
  });

  it('resets to declared stored files and enforces required/upload validation', async () => {
    const initial = stored('existing');
    render(<form>
      <CgFileUploader upload={async () => ({ succeeded: true })} name="files" required validationMode="require-all-succeeded" defaultStoredFiles={[initial]} />
      <button type="reset">Reset</button>
    </form>);
    expect(document.querySelector('input[name="files"]')).toHaveValue('existing');
    await userEvent.click(screen.getByRole('button', { name: 'Remove existing.pdf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.getByText('existing.pdf')).toBeInTheDocument());
    expect(document.querySelector('input[name="files"]')).toHaveValue('existing');
  });

  it('exposes safe imperative actions and cleans up under Strict Mode', async () => {
    let actions: CgFileUploaderActions | null = null;
    const view = render(<StrictMode><CgFileUploader upload={async () => ({ succeeded: true })} actionsRef={(value) => { actions = value; }} /></StrictMode>);
    expect(actions).not.toBeNull();
    actions!.focus();
    expect(screen.getByLabelText('Select files to upload')).toHaveFocus();
    expect(actions!.getItems()).toEqual([]);
    const capturedActions = actions!;
    view.unmount();
    await expect(capturedActions.upload()).resolves.toBeUndefined();
  });
});
