import { createGridXlsx, processLocalGridData } from '../../index';
import type { CgGridColumnDescriptor, CgGridDataProvider, CgGridDataRequest, CgGridExportOptions, CgGridKey, CgGridRemoteExportContext } from '../../index';

/** In-memory host example. A server must independently authorize rows and fields. */
export function gridRemoteExportExample<T>(records: readonly T[], columns: readonly CgGridColumnDescriptor<T>[], key: (item: T) => CgGridKey) {
  const query = (request: CgGridDataRequest) => processLocalGridData({ data: records, columns, groups: [], summaries: [], groupSummaries: [],
    searchText: request.searchText, filter: request.filter, sorts: request.sorts,
    pageIndex: Math.floor(request.skip / Math.max(1, request.take)), pageSize: request.take,
  });
  const dataProvider: CgGridDataProvider<T> = (request, { signal }) => {
    signal.throwIfAborted();
    const result = query(request);
    return Promise.resolve({ rows: result.pageItems, totalCount: result.totalCount, authorizedFilteredRowCount: result.totalCount });
  };
  const remoteExport = (request: CgGridDataRequest, options: CgGridExportOptions, context: CgGridRemoteExportContext) => {
    context.signal.throwIfAborted();
    const result = query(request);
    const selected = new Set(context.selectedKeys);
    const rows = context.scope === 'currentPage' ? result.pageItems : context.scope === 'selectedRecords'
      ? records.filter((item) => { const value = key(item); return selected.has(value instanceof Date ? `date:${value.toISOString()}` : `${typeof value}:${String(value)}`); }) : result.filteredSortedItems;
    // Replace this in-memory branch with the host's authorized export endpoint.
    // Never trust client field IDs or row keys as proof of access.
    return Promise.resolve(createGridXlsx(rows, context.authorizedFieldIds.flatMap((id) => columns.filter((column) => column.fieldId === id)), options.fileName, { maxRows: context.maxRows, signal: context.signal }));
  };
  return { dataProvider, remoteExport };
}
