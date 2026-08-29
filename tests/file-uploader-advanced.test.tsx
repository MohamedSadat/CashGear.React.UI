import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgFileUploader } from '../src/components/FileUploader';
import { registerFileDropRoot } from '../src/components/FileUploader/fileDragGuard';
import { totalProgress } from '../src/components/FileUploader/fileUploaderState';
import type { InternalUploadItem } from '../src/components/FileUploader/fileUploaderState';
import { saveSession } from '../src/components/FileUploader/endpointTransport';
import type { CgStoredFile } from '../src/components/FileUploader';

const select = (files: File[]) => fireEvent.change(screen.getByLabelText('Select files to upload'), { target: { files } });
const stored = (id: string): CgStoredFile => ({ id, location: `/files/${id}`, name: `${id}.pdf`, size: 4, contentType: 'application/pdf', metadata: {} });

describe('CgFileUploader advanced behavior', () => {
  it('drains files selected while an automatic run is already active', async () => {
    let release: (() => void) | undefined;
    const calls: string[] = [];
    render(<CgFileUploader upload={({ file }) => {
      calls.push(file.name);
      if (file.name === 'first.txt') return new Promise((resolve) => { release = () => resolve({ succeeded: true }); });
      return { succeeded: true };
    }} />);
    select([new File(['first'], 'first.txt')]);
    await waitFor(() => expect(screen.getByText('Uploading…')).toBeInTheDocument());
    select([new File(['second'], 'second.txt')]);
    release?.();
    await waitFor(() => expect(screen.getAllByText('Uploaded')).toHaveLength(2));
    expect(calls).toEqual(['first.txt', 'second.txt']);
  });

  it('buffers only when requested and freezes metadata before invoking the handler', async () => {
    const upload = vi.fn(async ({ buffer, metadata }: { buffer?: ArrayBuffer; metadata: Readonly<Record<string, string>> }) => {
      expect(new TextDecoder().decode(buffer)).toBe('body');
      expect(Object.isFrozen(metadata)).toBe(true);
      return { succeeded: true as const };
    });
    render(<CgFileUploader upload={upload} bufferToMemory getUploadMetadata={() => ({ module: 'payables' })} />);
    select([new File(['body'], 'body.txt')]);
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
  });

  it('implements selection-only and require-all-succeeded native validation', async () => {
    const firstSubmit = vi.fn();
    const first = render(<form onSubmit={(event) => { event.preventDefault(); firstSubmit(); }}><CgFileUploader upload={async () => ({ succeeded: true })} autoUpload={false} required validationMode="selection-only" /><button type="submit">Selection submit</button></form>);
    select([new File(['pending'], 'pending.txt')]);
    await screen.findByText('Ready');
    await userEvent.click(screen.getByRole('button', { name: 'Selection submit' }));
    expect(firstSubmit).toHaveBeenCalledOnce();
    first.unmount();

    const secondSubmit = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); secondSubmit(); }}><CgFileUploader upload={async () => ({ succeeded: true })} autoUpload={false} required validationMode="require-all-succeeded" /><button type="submit">Complete submit</button></form>);
    select([new File(['pending'], 'pending.txt')]);
    await screen.findByText('Ready');
    await userEvent.click(screen.getByRole('button', { name: 'Complete submit' }));
    expect(secondSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Select files to upload')).toHaveFocus();
  });

  it('serializes durable files, excludes disabled uploaders, and retains read-only values', () => {
    const durable = stored('durable');
    render(<form>
      <CgFileUploader upload={async () => ({ succeeded: true })} disabled name="disabledFile" defaultStoredFiles={[durable]} />
      <CgFileUploader upload={async () => ({ succeeded: true })} readOnly name="readonlyFile" defaultStoredFiles={[durable]} serializeStoredFile={(file) => JSON.stringify({ id: file.id })} />
    </form>);
    expect(document.querySelector('input[name="disabledFile"]')).toBeNull();
    expect(document.querySelector('input[name="readonlyFile"]')).toHaveValue('{"id":"durable"}');
  });

  it('renders safely on the server without touching browser-only state', () => {
    const html = renderToString(<CgFileUploader upload={async () => ({ succeeded: true })} defaultStoredFiles={[stored('server')]} />);
    expect(html).toContain('server.pdf');
    expect(html).toContain('type="file"');
  });

  it('calculates aggregate progress by file size and gives zero-byte files deterministic weight', () => {
    const item = (id: string, size: number, progress: number): InternalUploadItem => ({ id, file: null, name: id, size, contentType: '', lastModified: 0, status: 'uploading', progress, generation: 0 });
    expect(totalProgress([item('large', 300, 50), item('small', 100, 100)])).toBe(62);
    expect(totalProgress([item('empty', 0, 50)])).toBe(50);
  });

  it('reference-counts the global file-drop guard and ignores non-file drags', () => {
    const first = document.createElement('div'); const second = document.createElement('div');
    document.body.append(first, second);
    const cleanupFirst = registerFileDropRoot(first); const cleanupSecond = registerFileDropRoot(second);
    const drop = (types: string[]) => {
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { types } });
      document.body.dispatchEvent(event); return event.defaultPrevented;
    };
    expect(drop(['text/plain'])).toBe(false);
    expect(drop(['Files'])).toBe(true);
    cleanupFirst(); cleanupFirst();
    expect(drop(['Files'])).toBe(true);
    cleanupSecond();
    expect(drop(['Files'])).toBe(false);
    first.remove(); second.remove();
  });

  it('keeps a recovered session awaiting reselection when the fingerprint differs', async () => {
    saveSession('mismatch-test', {
      itemId: 'recovered', endpoint: '/api/mismatch', uploadId: 'up', sessionToken: 'private', name: 'expected.txt', size: 8,
      contentType: 'text/plain', lastModified: new Date(100).toISOString(), fingerprint: 'not-the-selected-fingerprint', metadata: {}, chunkSize: 4, chunkCount: 2, receivedChunks: [0],
    });
    render(<CgFileUploader uploadEndpoint="/api/mismatch" persistenceKey="mismatch-test" autoUpload={false} />);
    await waitFor(() => expect(screen.getByText('Select the same file to resume')).toBeInTheDocument());
    select([new File(['different'], 'expected.txt', { lastModified: 100 })]);
    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
    expect(screen.getByText('Select the same file to resume')).toBeInTheDocument();
    sessionStorage.removeItem('cg-fileuploader:v2:mismatch-test');
  });

  it('aborts on unmount without emitting a late terminal callback', async () => {
    let release: (() => void) | undefined;
    const terminal = vi.fn();
    const view = render(<CgFileUploader upload={() => new Promise((resolve) => { release = () => resolve({ succeeded: true }); })}
      onUploadSucceeded={terminal} onUploadFailed={terminal} onUploadCancelled={terminal} onUploadCompleted={terminal} />);
    select([new File(['late'], 'late.txt')]);
    await screen.findByText('Uploading…');
    view.unmount();
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(terminal).not.toHaveBeenCalled();
  });
});
