import type {
  CgGridActiveEditCell,
  CgGridBatchMutationRequest,
  CgGridBatchOperation,
  CgGridColumnDescriptor,
  CgGridEditMode,
  CgGridEditSnapshot,
  CgGridEditState,
  CgGridMutationResult,
  CgGridPersistenceState,
} from './CgGrid.types';

export function gridEditableColumns<TItem>(
  columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>,
  item: TItem,
  canEditCell?: (item: TItem, column: CgGridColumnDescriptor<TItem>) => boolean,
): ReadonlyArray<CgGridColumnDescriptor<TItem>> {
  return columns.filter((column) => Boolean(
    column.accessor
    && column.editor
    && !column.editor.disabled
    && !column.editor.readOnly
    && canEditCell?.(item, column) !== false,
  ));
}

export function gridChangedFieldIds<TItem>(
  columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>,
  initial: TItem,
  current: TItem,
): ReadonlyArray<string> {
  return columns
    .filter((column) => column.accessor && !Object.is(column.accessor(initial), column.accessor(current)))
    .map((column) => column.fieldId);
}

export function gridMutationOutcome(result: CgGridMutationResult): CgGridPersistenceState {
  if (result.succeeded || result.outcome === 'succeeded') return 'idle';
  if (result.outcome === 'conflict' || result.conflict) return 'conflict';
  return 'failed';
}

export function gridEditState<TItem>(
  mode: CgGridEditMode,
  snapshots: ReadonlyArray<CgGridEditSnapshot<TItem>>,
  activeCell: CgGridActiveEditCell | null,
  batchId?: string,
): CgGridEditState<TItem> {
  const active = snapshots.find((snapshot) => snapshot.rowKey === activeCell?.rowKey) ?? snapshots.at(-1);
  const dirtySnapshots = snapshots.filter((snapshot) => snapshot.operation !== 'update' || snapshot.changedFieldIds.length > 0 || snapshot.persistenceState === 'conflict' || snapshot.persistenceState === 'failed');
  const pending = snapshots.some((snapshot) => snapshot.persistenceState === 'saving' || snapshot.persistenceState === 'validating');
  const persistenceState: CgGridPersistenceState = pending
    ? (snapshots.some((snapshot) => snapshot.persistenceState === 'saving') ? 'saving' : 'validating')
    : snapshots.some((snapshot) => snapshot.persistenceState === 'conflict') ? 'conflict'
      : snapshots.some((snapshot) => snapshot.persistenceState === 'failed') ? 'failed'
        : dirtySnapshots.length ? 'dirty' : 'idle';
  return {
    mode,
    ...(batchId ? { batchId } : {}),
    activeCell,
    activeRowKey: activeCell?.rowKey ?? active?.rowKey ?? null,
    dirtyRowCount: dirtySnapshots.length,
    changeCount: dirtySnapshots.reduce((count, snapshot) => count + Math.max(1, snapshot.changedFieldIds.length), 0),
    pending,
    persistenceState,
    snapshots,
  };
}

export function gridBatchRequest<TItem>(batchId: string, snapshots: ReadonlyArray<CgGridEditSnapshot<TItem>>): CgGridBatchMutationRequest<TItem> {
  const operations = snapshots
    .slice()
    .sort((left, right) => left.firstChangeSequence - right.firstChangeSequence)
    .map((snapshot): CgGridBatchOperation<TItem> => {
      const common = {
        snapshotId: snapshot.snapshotId,
        changedFieldIds: snapshot.changedFieldIds,
        attemptNumber: snapshot.attemptNumber,
        firstChangeSequence: snapshot.firstChangeSequence,
        ...(snapshot.concurrencyToken ? { concurrencyToken: snapshot.concurrencyToken } : {}),
      };
      if (snapshot.operation === 'create') {
        if (snapshot.editModel === undefined) throw new Error('A batch create snapshot requires an edit model.');
        return { operation: 'create', createModel: snapshot.editModel, ...common };
      }
      if (!snapshot.rowKey || snapshot.originalItem === undefined) throw new Error(`A batch ${snapshot.operation} snapshot requires a row key and original item.`);
      if (snapshot.operation === 'delete') return { operation: 'delete', rowKey: snapshot.rowKey, item: snapshot.originalItem, ...common };
      if (snapshot.editModel === undefined) throw new Error('A batch update snapshot requires an edit model.');
      return { operation: 'update', rowKey: snapshot.rowKey, originalItem: snapshot.originalItem, editModel: snapshot.editModel, ...common };
    });
  return { batchId, operations };
}

export function validateGridEditingConfiguration(mode: CgGridEditMode, navigationPolicy: string | undefined, hasBatchHandler: boolean): void {
  if (mode !== 'popup' && navigationPolicy !== 'preserve' && navigationPolicy !== 'confirmDiscard' && navigationPolicy !== 'block') {
    throw new Error(`CgGrid editing mode "${mode}" requires a navigationPolicy.`);
  }
  if (mode === 'batch' && !hasBatchHandler) throw new Error('CgGrid batch editing requires an atomic commitBatch callback.');
}
