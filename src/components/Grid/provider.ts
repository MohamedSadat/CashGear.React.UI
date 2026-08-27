import { decodeFilterNode, encodeFilterNode } from '../../filter';
import type { CgFilterEvaluationContext, CgFilterFieldDescriptor } from '../../filter';
import type { CgGridColumnDescriptor, CgGridDataRequest, CgGridDataResult, CgGridGroupPath, CgGridProviderMode, CgGridState, CgGridSummaryDescriptor, CgGridWireDataRequest } from './CgGrid.types';
import { isSearchableColumn } from './columns';
import { CgGridFilterConfigurationError, validateGridFilter } from './filtering';
import { providerGridSummaries } from './summaries';

export interface CgGridDataRequestOptions<TItem> {
  readonly filterFields?: ReadonlyArray<CgFilterFieldDescriptor<TItem>>;
  readonly filterEvaluationContext?: CgFilterEvaluationContext;
  readonly isFilterFieldAuthorized?: (field: CgFilterFieldDescriptor<TItem>) => boolean;
}

export function createGridDataRequest<TItem>(state: CgGridState, columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, totalSummaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, groupSummaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, mode: CgGridProviderMode = state.groups.length ? 'groupNodes' : 'rows', path: CgGridGroupPath = { segments: [] }, skip = state.pageIndex * state.pageSize, options: CgGridDataRequestOptions<TItem> = {}): CgGridDataRequest {
  const validation = validateGridFilter(state.filter, columns, options.filterFields, options.filterEvaluationContext, options.isFilterFieldAuthorized, 'server');
  if (!state.filterDisabled && !validation.valid) throw new CgGridFilterConfigurationError('The Grid filter cannot be sent to the provider.', validation.problems);
  const isVisible = (summary: CgGridSummaryDescriptor<TItem>) => state.summaries.find((entry) => entry.id === summary.id && entry.aggregateKey === summary.aggregateKey)?.visible ?? summary.visible !== false;
  const visibleTotalSummaries = totalSummaries.filter(isVisible).map((summary) => ({ ...summary, visible: true }));
  const visibleGroupSummaries = groupSummaries.filter(isVisible).map((summary) => ({ ...summary, visible: true }));
  return { skip, take: state.pageSize, sorts: state.sorts, filter: state.filterDisabled ? null : validation.criteria, searchText: state.searchText.trim(), searchableFieldIds: columns.filter(isSearchableColumn).map((column) => column.fieldId), totalSummaries: providerGridSummaries(visibleTotalSummaries, 'total'), mode, groups: state.groups, groupPath: path, groupSummaries: providerGridSummaries(visibleGroupSummaries, 'group') };
}

export function encodeGridDataRequest(request: CgGridDataRequest): CgGridWireDataRequest {
  const { searchableFieldIds, filter, ...rest } = request;
  return { ...rest, searchFields: [...searchableFieldIds], filter: encodeFilterNode(decodeFilterNode(filter)) };
}

function readStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) throw new CgGridFilterConfigurationError('A Grid request requires a searchFields array.');
  const result: string[] = [];
  for (const candidate of value as ReadonlyArray<unknown>) {
    if (typeof candidate !== 'string' || !candidate.trim()) throw new CgGridFilterConfigurationError('A Grid request contains an invalid search field.');
    result.push(candidate);
  }
  return result;
}

export function decodeGridDataRequest(request: CgGridWireDataRequest): CgGridDataRequest {
  if (!Number.isSafeInteger(request.skip) || request.skip < 0 || !Number.isSafeInteger(request.take) || request.take <= 0) throw new CgGridFilterConfigurationError('A Grid request requires safe non-negative skip and positive take values.');
  const { searchFields, filter, ...rest } = request;
  return { ...rest, searchableFieldIds: readStringArray(searchFields), filter: decodeFilterNode(filter) };
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
