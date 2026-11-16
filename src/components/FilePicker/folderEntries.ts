export interface PathedFile {
  file: File;
  /** The file's path below what was dropped or chosen, with `/` between folders. */
  path: string;
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walk(entry: FileSystemEntry, out: PathedFile[]): Promise<void> {
  if (entry.isFile) {
    out.push({ file: await fileOf(entry as FileSystemFileEntry), path: entry.fullPath.replace(/^\/+/u, '') });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // A reader gives a directory's entries in batches until it gives none.
  for (let batch = await readEntries(reader); batch.length; batch = await readEntries(reader)) {
    for (const child of batch) await walk(child, out);
  }
}

/**
 * The files dropped, folders read through to their files, each with its path below the drop.
 * `null` when the browser cannot read dropped folders: the caller falls back to the flat list.
 */
export async function droppedFiles(items: DataTransferItemList | undefined): Promise<PathedFile[] | null> {
  if (!items?.length || typeof DataTransferItem === 'undefined' || typeof DataTransferItem.prototype.webkitGetAsEntry !== 'function') return null;
  // Entries must be taken while the drop event is being handled; reading them may come later.
  const entries = Array.from(items).filter((item) => item.kind === 'file').map((item) => item.webkitGetAsEntry()).filter((entry): entry is FileSystemEntry => entry !== null);
  if (!entries.length) return null;
  const out: PathedFile[] = [];
  for (const entry of entries) await walk(entry, out);
  return out;
}
