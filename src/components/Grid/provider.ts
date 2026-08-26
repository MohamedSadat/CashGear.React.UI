import type { CgGridColumnDescriptor, CgGridDataRequest, CgGridDataResult, CgGridGroupPath, CgGridProviderMode, CgGridState, CgGridSummaryDescriptor } from './CgGrid.types';
import { isSearchableColumn } from './columns';

export function createGridDataRequest<TItem>(state: CgGridState, columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, totalSummaries: ReadonlyArray<CgGridSummaryDescriptor>, groupSummaries: ReadonlyArray<CgGridSummaryDescriptor>, mode: CgGridProviderMode = state.groups.length ? 'groupNodes' : 'rows', path: CgGridGroupPath = { segments: [] }, skip = state.pageIndex * state.pageSize): CgGridDataRequest {
  return { skip, take: state.pageSize, sorts: state.sorts, filter: state.filter, searchText: state.searchText.trim(), searchableFieldIds: columns.filter(isSearchableColumn).map((column) => column.fieldId), totalSummaries, mode, groups: state.groups, groupPath: path, groupSummaries };
}

export function validateGridDataResult<TItem>(result: CgGridDataResult<TItem>, mode: CgGridProviderMode): void {
  if (!Number.isSafeInteger(result.totalCount) || result.totalCount < 0) throw new Error('CgGrid provider result totalCount must be a non-negative safe integer.');
  if (!Number.isSafeInteger(result.authorizedFilteredRowCount) || result.authorizedFilteredRowCount < 0) throw new Error('CgGrid provider authorizedFilteredRowCount must be a non-negative safe integer.');
  if (mode === 'groupNodes') {
    if (result.rows?.length) throw new Error('CgGrid GroupNodes result cannot contain rows.');
    if (!result.groupNodes) throw new Error('CgGrid GroupNodes result must contain groupNodes.');
  } else if (result.groupNodes?.length) throw new Error(`CgGrid ${mode} result cannot contain groupNodes.`);
}

export class CgGridRequestCoordinator {
  #generation = 0;
  #controller?: AbortController;
  begin(): { readonly generation: number; readonly signal: AbortSignal } { this.#controller?.abort(); this.#controller = new AbortController(); return { generation: ++this.#generation, signal: this.#controller.signal }; }
  current(generation: number): boolean { return generation === this.#generation && !this.#controller?.signal.aborted; }
  cancel(): void { this.#controller?.abort(); this.#generation++; }
}
