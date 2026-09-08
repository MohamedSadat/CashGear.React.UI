# Editor commit scopes

Wrap a transaction form in `CgEditorCommitProvider` and read its API with `useCgEditorCommit()`. Nested providers are isolated. `await scope.commit(validate)` flushes registered editors in order, waits for their value callbacks, then invokes optional validation. It returns false for invalid drafts or active composition. Publication exceptions propagate so the form can display its own error. `resetDrafts()` invalidates queued publications and restores bound values without publishing.

TextBox, NumericEdit and SpinEdit also accept an `actionsRef` with `flush()` and `resetDraft()`. Keep persistence in the form save callback, after commit. Callbacks already executing in application code cannot be undone by resetting a scope.

Popup and Window accept `closePolicy` with `isBusy`, synchronous or asynchronous `hasUnsavedChanges`, and `confirmDiscard`. Dirty dialogs without a discard callback remain open. The asynchronous dirty check takes an AbortSignal and takes precedence over the synchronous check. Policy evaluation precedes `onBeforeClose`, and overlapping policy-driven close requests share one decision. Controlled `open` changes and unmount remain authoritative: guard navigation and parent-driven transitions in the host.

Grid and TreeList provide isolated scopes for their edit surfaces and flush them before persistence. Custom editors can be built from the registered controls. Existing immediate publication, controlled props, and native refs are preserved.
