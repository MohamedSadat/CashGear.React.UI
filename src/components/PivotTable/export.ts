import type { CgPivotExportFile, CgPivotExportFormat, CgPivotField, CgPivotLayout, CgPivotResult } from './CgPivotTable.types';
import { cellKey } from './engine';
import { abort, checkLimit, CgPivotError } from './model';
import { formatPivotValue, pivotProjection } from './projection';
const encoder = new TextEncoder();
function xml(value: string): string { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); } // eslint-disable-line no-control-regex
const columnName = (index: number): string => { let s = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
function zip(files: ReadonlyArray<[
    string,
    string
]>): Uint8Array {
    const chunks: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    const header = (size: number) => new DataView(new ArrayBuffer(size));
    const write = (view: DataView, values: ReadonlyArray<[
        number,
        number,
        number
    ]>) => { for (const [at, n, bytes] of values)
        if (bytes === 2)
            view.setUint16(at, n, true);
        else
            view.setUint32(at, n, true); };
    for (const [path, text] of files) {
        const name = encoder.encode(path), data = encoder.encode(text);
        let crc = 0xffffffff;
        for (const byte of data) {
            crc ^= byte;
            for (let i = 0; i < 8; i++)
                crc = crc >>> 1 ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const local = header(30);
        write(local, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x800, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2]]);
        chunks.push(new Uint8Array(local.buffer), name, data);
        const record = header(46);
        write(record, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x800, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, offset, 4]]);
        central.push(new Uint8Array(record.buffer), name);
        offset += 30 + name.length + data.length;
    }
    const length = central.reduce((n, c) => n + c.length, 0);
    const end = header(22);
    write(end, [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, length, 4], [16, offset, 4]]);
    chunks.push(...central, new Uint8Array(end.buffer));
    const result = new Uint8Array(offset + length + 22);
    let cursor = 0;
    for (const chunk of chunks) {
        result.set(chunk, cursor);
        cursor += chunk.length;
    }
    return result;
}
function safeName(name: string | undefined, format: CgPivotExportFormat): string { return `${(name ?? 'pivot').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.(xlsx|csv)$/i, '').replace(/[. ]+$/, '').slice(0, 160) || 'pivot'}.${format}`; } // eslint-disable-line no-control-regex
export function createPivotExport<T>(result: CgPivotResult, layout: CgPivotLayout, fields: ReadonlyArray<CgPivotField<T>>, format: CgPivotExportFormat, options: {
    fileName?: string;
    rightToLeft?: boolean;
    locale?: string;
    maximumCells?: number;
    signal?: AbortSignal;
    grandTotalText?: string;
} = {}): CgPivotExportFile {
    abort(options.signal);
    if(result.isPartial)throw new CgPivotError('A complete pivot result is required for export.');
    const { rows, columns } = pivotProjection(result, layout, fields, options.grandTotalText ?? 'Grand Total', true);
    checkLimit('exportCells', rows.length * columns.length, options.maximumCells ?? 2000000);
    const lookup = new Map(result.cells.map(c => [cellKey(c.rowPathKey, c.columnPathKey, c.dataFieldKey), c]));
    const depth = Math.max(1, ...columns.map(c => c.axis.node?.path.length ?? 1));
    const headers = depth + 1;
    const label = (column: typeof columns[number], level: number) => column.axis.grand ? (level === 0 ? column.axis.label : '') : column.axis.node?.path[level]?.displayText ?? '';
    const dataValue = (r: typeof rows[number], c: typeof columns[number]) => lookup.get(cellKey(r.key, c.axis.key, c.measure.key))?.value ?? null;
    let bytes: Uint8Array;
    if (format === 'csv') {
        const escape = (s: string) => `"${(/^[\s]*[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`;
        const lines = [['Rows', ...columns.map(c => `${c.axis.node?.path.map(p => p.displayText).join(' / ') ?? c.axis.label} / ${c.field.caption ?? c.field.key}`)].map(escape).join(',')];
        for (const row of rows) {
            abort(options.signal);
            lines.push([`${'  '.repeat(row.node?.level ?? 0)}${row.label}`, ...columns.map(c => formatPivotValue(dataValue(row, c), c.field, options.locale))].map(escape).join(','));
        }
        bytes = encoder.encode('\uFEFF' + lines.join('\r\n') + '\r\n');
    }
    else {
        checkLimit('xlsxRows', rows.length + headers, 1048576);
        checkLimit('xlsxColumns', columns.length + 1, 16384);
        const text = (ref: string, value: string, style = 0) => `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
        const formats = columns.map(c => { const f = c.field.cellFormat; const m = f && /^([NnFfPpCc])(\d{0,2})$/.exec(f); if (!m)
            return f ?? 'General'; const precision = Number(m[2] || 2); return `${m[1]!.toUpperCase() === 'C' ? '"' + (c.field.currency ?? 'USD') + '" ' : ''}${['N', 'C'].includes(m[1]!.toUpperCase()) ? '#,##0' : '0'}${precision ? '.' + '0'.repeat(precision) : ''}${m[1]!.toUpperCase() === 'P' ? '%' : ''}`; });
        const sheetRows: string[] = [];
        const merges: string[] = [];
        for (let level = 0; level < depth; level++) {
            sheetRows.push(`<row r="${level + 1}">${text(`A${level + 1}`, level === 0 ? 'Rows' : '', 1)}${columns.map((c, i) => text(`${columnName(i + 1)}${level + 1}`, label(c, level), 1)).join('')}</row>`);
            for (let start = 0; start < columns.length;) {
                let end = start;
                const key = (i: number) => JSON.stringify(columns[i]!.axis.node?.path.slice(0, level + 1).map(p => p.key) ?? ['grand']);
                while (end + 1 < columns.length && key(end + 1) === key(start) && label(columns[start]!, level))
                    end++;
                if (end > start)
                    merges.push(`${columnName(start + 1)}${level + 1}:${columnName(end + 1)}${level + 1}`);
                start = end + 1;
            }
        }
        sheetRows.push(`<row r="${headers}">${text(`A${headers}`, '', 1)}${columns.map((c, i) => text(`${columnName(i + 1)}${headers}`, c.field.caption ?? c.field.key, 1)).join('')}</row>`);
        rows.forEach((r, index) => {
            abort(options.signal);
            const n = index + headers + 1;
            sheetRows.push(`<row r="${n}" outlineLevel="${Math.min(r.node?.level ?? 0, 7)}">${text(`A${n}`, `${'  '.repeat(r.node?.level ?? 0)}${r.label}`, r.total ? 1 : 0)}${columns.map((c, i) => {
                const value = dataValue(r, c);
                const ref = `${columnName(i + 1)}${n}`;
                const style = 2 + i * 2 + (r.total || c.axis.total ? 1 : 0);
                if (value === null)
                    return `<c r="${ref}" s="${style}"/>`;
                if (typeof value === 'boolean')
                    return `<c r="${ref}" t="b" s="${style}"><v>${value ? 1 : 0}</v></c>`;
                const numeric = (typeof value === 'number' || c.field.valueType === 'decimal' || c.field.valueType === 'number' || c.field.calculated) && /^-?\d+(?:\.\d+)?$/.test(String(value));
                const significant = String(value).replace(/[-.]/g, '').replace(/^0+/, '').length;
                return numeric && significant <= 15 ? `<c r="${ref}" s="${style}"><v>${xml(String(value))}</v></c>` : text(ref, String(value), style);
            }).join('')}</row>`);
        });
        const styles = `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${formats.length}">${formats.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xml(f)}"/>`).join('')}</numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${2 + formats.length * 2}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/>${formats.map((_, i) => [0, 1].map(b => `<xf numFmtId="${164 + i}" fontId="${b}" fillId="0" borderId="0" applyNumberFormat="1"/>`).join('')).join('')}</cellXfs></styleSheet>`;
        const worksheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="${options.rightToLeft ? 1 : 0}"><pane xSplit="1" ySplit="${headers}" topLeftCell="B${headers + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="${Math.max(2, columns.length + 1)}" width="18" customWidth="1"/></cols><sheetData>${sheetRows.join('')}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : ''}</worksheet>`;
        bytes = zip([
            ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
            ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
            ['xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pivot" sheetId="1" r:id="rId1"/></sheets></workbook>'],
            ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
            ['xl/worksheets/sheet1.xml', worksheet], ['xl/styles.xml', styles],
        ]);
    }
    return { fileName: safeName(options.fileName, format), mimeType: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes, rowCount: rows.length };
}
export function downloadPivotExport(file: CgPivotExportFile): void {
    if (typeof document === 'undefined')
        throw new Error('Pivot download requires a browser.');
    const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
