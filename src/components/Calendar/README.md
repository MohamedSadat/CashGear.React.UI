# Calendar multiple selection

`selectionMode="multiple"` accepts readonly date arrays for `value`, `defaultValue`, and `onValueChange`. Snapshots are normalized, deduplicated, sorted and frozen. A plain click replaces selection; Ctrl/Meta toggles a date; Shift replaces with the anchored range, and Ctrl/Meta+Shift adds the range. Restricted dates are skipped, including during keyboard range extension. Clear emits an empty snapshot. Controlled values remain authoritative. Single and range selection contracts and defaults are unchanged.
