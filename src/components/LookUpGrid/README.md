
## Asynchronous selection callbacks (Phase 33)

Value, selected-item, item-select and clear callbacks may return PromiseLike<void>. They run in their existing order and settle before controlled-value reconciliation. Existing void callbacks that return an ignored value remain type-compatible. A newer selection/clear/reset, source/context/version replacement, unrelated authoritative value, or unmount invalidates older callback completion. Rejection restores the current authoritative value (or the previous uncontrolled value) only while the transaction owns the selection. Persistence remains host-owned.
