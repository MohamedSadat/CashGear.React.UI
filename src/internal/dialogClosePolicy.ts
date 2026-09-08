export interface CgDialogClosePolicy {
  isBusy?: () => boolean;
  hasUnsavedChanges?: () => boolean;
  hasUnsavedChangesAsync?: (signal: AbortSignal) => boolean | PromiseLike<boolean>;
  confirmDiscard?: (signal: AbortSignal) => boolean | PromiseLike<boolean>;
}
export async function evaluateDialogClosePolicy(policy: CgDialogClosePolicy, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted || policy.isBusy?.()) return false;
  const dirty = policy.hasUnsavedChangesAsync ? await policy.hasUnsavedChangesAsync(signal) : policy.hasUnsavedChanges?.();
  if (signal.aborted || policy.isBusy?.()) return false;
  if (dirty && (!policy.confirmDiscard || !await policy.confirmDiscard(signal))) return false;
  return !signal.aborted && !policy.isBusy?.();
}
