import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { acceptTokens, fileMatches } from './accept';
import { CgFilePicker } from './CgFilePicker';
import type { CgFilePickerHandle } from './CgFilePicker.types';

const csv = new File(['a,b\n1,2'], 'بيانات.CSV', { type: 'text/csv' });
const tsv = new File(['a\tb'], 'data.tsv', { type: 'text/tab-separated-values' });
const png = new File(['x'], 'logo.png', { type: 'image/png' });

function drop(target: Element, files: File[], type = 'drop') {
  const event = createEvent[type === 'drop' ? 'drop' : 'dragOver'](target);
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files, dropEffect: 'none' } });
  fireEvent(target, event);
  return event;
}

describe('accept', () => {
  it('reads extensions, types and families as a file dialog does', () => {
    const tokens = acceptTokens('.csv, text/tab-separated-values ,image/*');
    expect(tokens).toEqual(['.csv', 'text/tab-separated-values', 'image/*']);
    expect(fileMatches(csv, tokens)).toBe(true);
    expect(fileMatches(tsv, tokens)).toBe(true);
    expect(fileMatches(png, tokens)).toBe(true);
    expect(fileMatches(new File([''], 'a.pdf', { type: 'application/pdf' }), tokens)).toBe(false);
    expect(fileMatches(png, acceptTokens(undefined))).toBe(true);
    expect(acceptTokens(['.csv', '.tsv,.txt'])).toEqual(['.csv', '.tsv', '.txt']);
  });
});

describe('CgFilePicker', () => {
  it('opens the dialog from its button and gives the file chosen, once per choice', async () => {
    const onPick = vi.fn();
    const { container } = render(<CgFilePicker accept={['.csv', 'text/csv']} onPick={onPick}>اختر ملفاً</CgFilePicker>);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveAttribute('aria-hidden', 'true');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'اختر ملفاً' }));
    expect(click).toHaveBeenCalledTimes(1);
    await userEvent.upload(input, csv);
    expect(onPick).toHaveBeenCalledWith([csv], { source: 'dialog', paths: expect.any(Array) });
    expect(input.value).toBe('');
  });

  it('gives only the first file unless multiple, and rejects files that do not match', async () => {
    const onPick = vi.fn();
    const onReject = vi.fn();
    const { container, rerender } = render(<CgFilePicker accept=".csv,.tsv" onPick={onPick} onReject={onReject}>ملفات</CgFilePicker>);
    const input = container.querySelector<HTMLInputElement>('input')!;
    fireEvent.change(input, { target: { files: [csv, tsv, png] } });
    expect(onPick).toHaveBeenLastCalledWith([csv], { source: 'dialog', paths: expect.any(Array) });
    expect(onReject).toHaveBeenLastCalledWith([png], { source: 'dialog', paths: expect.any(Array) });
    rerender(<CgFilePicker accept=".csv,.tsv" multiple onPick={onPick} onReject={onReject}>ملفات</CgFilePicker>);
    fireEvent.change(input, { target: { files: [csv, tsv] } });
    expect(onPick).toHaveBeenLastCalledWith([csv, tsv], { source: 'dialog', paths: expect.any(Array) });
    onPick.mockClear();
    fireEvent.change(input, { target: { files: [png] } });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('takes dropped files as a drop zone, marking itself while files are over it', () => {
    const onPick = vi.fn();
    const { container } = render(<CgFilePicker dropZone accept=".csv" hint="أو أفلت ملف CSV هنا" onPick={onPick}>اختر</CgFilePicker>);
    const zone = container.querySelector('[data-cg-file-picker]')!;
    expect(zone).toHaveTextContent('أو أفلت ملف CSV هنا');
    const enter = createEvent.dragEnter(zone);
    Object.defineProperty(enter, 'dataTransfer', { value: { types: ['Files'], files: [] } });
    fireEvent(zone, enter);
    expect(zone).toHaveAttribute('data-drag-over');
    expect(drop(zone, [csv], 'dragover').defaultPrevented).toBe(true);
    drop(zone, [csv]);
    expect(onPick).toHaveBeenCalledWith([csv], { source: 'drop', paths: expect.any(Array) });
    expect(zone).not.toHaveAttribute('data-drag-over');
  });

  it('ignores drops unless a drop zone, and when disabled', () => {
    const onPick = vi.fn();
    const { container, rerender } = render(<CgFilePicker onPick={onPick}>اختر</CgFilePicker>);
    const zone = container.querySelector('[data-cg-file-picker]')!;
    expect(drop(zone, [csv], 'dragover').defaultPrevented).toBe(false);
    drop(zone, [csv]);
    rerender(<CgFilePicker dropZone disabled onPick={onPick}>اختر</CgFilePicker>);
    drop(zone, [csv]);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'اختر' })).toBeDisabled();
  });

  it('opens and focuses through its handle, and reports a cancelled dialog', () => {
    const ref = createRef<CgFilePickerHandle>();
    const onCancel = vi.fn();
    const { container } = render(<CgFilePicker ref={ref} onPick={vi.fn()} onCancel={onCancel}>اختر</CgFilePicker>);
    const input = container.querySelector<HTMLInputElement>('input')!;
    const click = vi.spyOn(input, 'click');
    ref.current!.open();
    expect(click).toHaveBeenCalledTimes(1);
    ref.current!.focus();
    expect(screen.getByRole('button', { name: 'اختر' })).toHaveFocus();
    input.dispatchEvent(new Event('cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('chooses a folder: every matching file, with its path below the folder', async () => {
    const onPick = vi.fn();
    const onReject = vi.fn();
    const { container } = render(<CgFilePicker directory accept=".md" onPick={onPick} onReject={onReject}>اختر مجلداً</CgFilePicker>);
    const input = container.querySelector<HTMLInputElement>('input')!;
    expect(input).toHaveAttribute('webkitdirectory');
    expect(input.multiple).toBe(true);
    const note = new File(['# x'], 'plan.md', { type: 'text/markdown' });
    Object.defineProperty(note, 'webkitRelativePath', { value: 'notes/2026/plan.md' });
    const image = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(image, 'webkitRelativePath', { value: 'notes/logo.png' });
    fireEvent.change(input, { target: { files: [note, image] } });
    expect(onPick).toHaveBeenCalledWith([note], { source: 'dialog', paths: ['notes/2026/plan.md'] });
    expect(onReject).toHaveBeenCalledWith([image], { source: 'dialog', paths: ['notes/logo.png'] });
  });
});
