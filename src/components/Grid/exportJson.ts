import { awaitWithAbort } from '../../internal/awaitWithAbort';
import type { CgGridColumnDescriptor } from './CgGrid.types';
interface JsonSettings { signal?: AbortSignal; maxRows?: number; maxCells?: number; fileName?: string }
const MIME = 'application/json' as const;
const encoder = new TextEncoder();
export function jsonColumns<T>(columns: readonly CgGridColumnDescriptor<T>[]): readonly CgGridColumnDescriptor<T>[] { return columns.filter(column => column.visible !== false && column.exportEnabled !== false && column.accessor && !['selection', 'command', 'template'].includes(column.type)); }
export function validateJsonLimits(rowCount: number, fieldCount: number, settings: JsonSettings): void {
  for (const [name, value] of [['maxRows', settings.maxRows], ['maxCells', settings.maxCells]] as const) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new RangeError(`Grid export ${name} must be a non-negative safe integer.`);
  if (rowCount > (settings.maxRows ?? Number.MAX_SAFE_INTEGER)) throw new RangeError('Grid export row limit exceeded.');
  if (fieldCount && rowCount > (settings.maxCells ?? Number.MAX_SAFE_INTEGER) / fieldCount) throw new RangeError('Grid export cell limit exceeded.');
}
export function jsonFileName(value = 'grid-export.json'): string {
  // eslint-disable-next-line no-control-regex
  const stem = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.json$/i, '').replace(/[. ]+$/g, '') || 'grid-export';
  return `${stem.slice(0, 175)}.json`;
}
function* jsonChunks<T>(items: readonly T[], columns: readonly CgGridColumnDescriptor<T>[], settings: JsonSettings): Generator<string> {
  validateJsonLimits(items.length, columns.length, settings); settings.signal?.throwIfAborted(); yield '[';
  let index = 0;
  for (const item of items) {
    settings.signal?.throwIfAborted();
    try {
      const row: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const column of columns) row[column.fieldId] = column.accessor!(item);
      const text = JSON.stringify(row, (_key, value: unknown) => {
        if (['bigint', 'function', 'symbol'].includes(typeof value)) throw new TypeError(`Unsupported JSON value: ${typeof value}.`);
        return value;
      });
      yield `${index++ ? ',' : ''}${text}`;
    } catch (cause) { throw new TypeError(`Grid JSON export failed at record ${index + 1}: ${cause instanceof Error ? cause.message : 'unsupported or circular value'}`, { cause }); }
  }
  settings.signal?.throwIfAborted(); yield ']';
}
export async function createGridJson<T>(items: readonly T[], columns: readonly CgGridColumnDescriptor<T>[], settings: JsonSettings = {}) {
  const exported = jsonColumns(columns), chunks: string[] = [];
  for (const chunk of jsonChunks(items, exported, settings)) { chunks.push(chunk); if (chunks.length % 256 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0)); }
  settings.signal?.throwIfAborted(); const text = chunks.join('');
  return { rowCount: items.length, fileName: jsonFileName(settings.fileName), mimeType: MIME, text, bytes: encoder.encode(text) };
}
/** Caller owns destination lifetime. On failure, discard any partially written JSON. */
export async function writeGridJson<T>(destination: WritableStream<Uint8Array>, items: readonly T[], columns: readonly CgGridColumnDescriptor<T>[], settings: JsonSettings = {}) {
  const exported = jsonColumns(columns); validateJsonLimits(items.length, exported.length, settings); settings.signal?.throwIfAborted();
  const writer = destination.getWriter(); let byteLength = 0, count = 0;
  try {
    for (const chunk of jsonChunks(items, exported, settings)) {
      const bytes = encoder.encode(chunk); settings.signal?.throwIfAborted();
      const pending = writer.write(bytes); await (settings.signal ? awaitWithAbort(pending, settings.signal) : pending); byteLength += bytes.length;
      if (++count % 256 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    settings.signal?.throwIfAborted();
    return { rowCount: items.length, byteLength, fieldIds: Object.freeze(exported.map(column => column.fieldId)) };
  } finally { writer.releaseLock(); }
}
