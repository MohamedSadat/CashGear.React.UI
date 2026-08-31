/* eslint-disable no-control-regex, @typescript-eslint/no-base-to-string -- output escaping accepts serializable values. */
import type { CgTreeListColumn, CgTreeListExportResult, CgTreeListKey, CgTreeListSnapshotRow } from './CgTreeList.types';
import { formatTreeListValue } from './hierarchy';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const;
const encoder = new TextEncoder();
const xml = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function crc32(bytes: Uint8Array): number { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
const u16 = (value: number) => Uint8Array.of(value & 255, value >>> 8 & 255);
const u32 = (value: number) => Uint8Array.of(value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255);
function join(chunks: ReadonlyArray<Uint8Array>): Uint8Array { const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result; }
function zip(entries: ReadonlyArray<{ readonly name: string; readonly data: string }>): Uint8Array {
  const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) { const name = encoder.encode(entry.name); const data = encoder.encode(entry.data); const crc = crc32(data); const local = join([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]); locals.push(local); centrals.push(join([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name])); offset += local.length; }
  const central = join(centrals); return join([...locals, central, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)]);
}
function columnName(index: number): string { let result = ''; for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + (value - 1) % 26) + result; return result; }
function inlineCell(reference: string, value: unknown): string { return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`; }
export function sanitizeTreeListExportFileName(value = 'tree-list.xlsx'): string { const base = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '') || 'tree-list'; return `${base.replace(/\.xlsx$/i, '')}.xlsx`.slice(0, 180); }

export function createTreeListXlsx<TItem, TKey extends CgTreeListKey>(options: {
  readonly rows: ReadonlyArray<CgTreeListSnapshotRow<TItem, TKey>>;
  readonly columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>;
  readonly hierarchyFieldId: string;
  readonly fileName?: string;
  readonly rightToLeft?: boolean;
  readonly locale?: string;
  readonly signal?: AbortSignal;
}): CgTreeListExportResult {
  const columns = options.columns.filter((column) => column.exportEnabled !== false && column.getValue && !['selection', 'command'].includes(column.type));
  const header = `<row r="1">${columns.map((column, index) => inlineCell(`${columnName(index)}1`, column.title ?? column.fieldId)).join('')}</row>`;
  const body = options.rows.map((row, rowIndex) => {
    if ((rowIndex & 1023) === 0 && options.signal?.aborted) throw new Error('CgTreeList XLSX export was aborted.');
    const cells = columns.map((column, columnIndex) => {
      let value = formatTreeListValue(column, row.item, options.locale);
      if (column.fieldId === options.hierarchyFieldId) value = `${'  '.repeat(Math.min(row.level - 1, 64))}${value}`;
      return inlineCell(`${columnName(columnIndex)}${rowIndex + 2}`, value);
    }).join('');
    return `<row r="${rowIndex + 2}" outlineLevel="${Math.min(Math.max(0, row.level - 1), 7)}">${cells}</row>`;
  }).join('');
  const sheetView = options.rightToLeft ? '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>' : '';
  const entries = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tree" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetView}<sheetPr><outlinePr summaryBelow="1"/></sheetPr><sheetData>${header}${body}</sheetData></worksheet>` },
  ];
  return { fileName: sanitizeTreeListExportFileName(options.fileName), mimeType: MIME, bytes: zip(entries), rowCount: options.rows.length };
}

export function downloadTreeListExport(result: CgTreeListExportResult): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') throw new Error('Browser downloading is unavailable in this environment.');
  const url = URL.createObjectURL(new Blob([result.bytes as BlobPart], { type: result.mimeType }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.fileName; anchor.click(); URL.revokeObjectURL(url);
}
