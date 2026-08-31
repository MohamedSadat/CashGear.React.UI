# CgTreeList

`CgTreeList<TItem, TKey>` is a true ARIA treegrid for hierarchical business records: charts of accounts, bills of materials, cost centers, warehouses, approval structures, product/category trees, and nested financial reports. It is not a file explorer, arbitrary graph editor, Gantt chart, or PivotTable.

The React implementation is pinned to the clean Blazor reference at commit `51d7689a7d407713fa18cb6268158b1a4f461fb3`. It is an independent component, not a `CgGrid` wrapper or subclass. It reuses only compatible contracts and engines: the structured Filter AST, Grid sort/summary vocabulary, `CgPager`, `CgContextMenu`, `CgPopup`, icon/tokens, and browser XLSX value rules.

## Binding and stable identity

Exactly one discriminated binding source is required.

```tsx
const noParent = { kind: 'none' } as const;

<CgTreeList
  data={accounts}
  getKey={(account) => account.id}
  getParentKey={(account) => account.parentId == null
    ? noParent
    : { kind: 'key', key: account.parentId }}
  columns={columns}
/>
```

- Flat binding uses `data`, `getKey`, and `getParentKey`, with optional `isRoot`, `rootParentKeys`, `orphanPolicy`, `hasChildren`, and `loadChildren`.
- Nested binding uses root `data`, `getKey`, and `getChildren`; `null`/`undefined` children are empty and repeated keys are first-parent-wins.
- Provider binding uses only `dataProvider`. Requests are bounded, structured, abortable records for roots, children, paths, groups, snapshots, and summaries.

Keys are non-empty strings or finite numbers. Parent absence is `{ kind: 'none' }`; `0` is never inferred to mean root. Root precedence is explicit `isRoot`, explicit parent absence, then `rootParentKeys` sentinel matching.

Every hierarchy traversal is iterative. The default maximum depth is 512 and the hard configurable ceiling is 10,000. Flat duplicates throw. Nested repeats are skipped. Self-parent and circular chains are handled by `orphanPolicy`: `treat-as-root` (default), `hide`, or `throw`. Caller data and collections are never mutated.

## Columns and hierarchy behavior

Columns are immutable descriptors: `data`, `text`, `number`, `date`, `boolean`, `template`, `selection`, and `command`. One visible non-selection column is the hierarchy column. More than one explicit `hierarchy: true` throws; when omitted, the first eligible visible column is selected and personalization cannot hide it.

Sorting is always sibling-local. Search reads formatted searchable values. The shared structured filter AST is evaluated with the Filter Core registry. Filter modes are `match-only`, `match-with-ancestors` (default), and `ancestors-and-descendants`. Filter-opened ancestors are transient; clearing the query restores the exact host expansion set. Highlighting uses React `<mark>` fragments and never injects HTML.

Expansion, selection, focus, checks, detail rows, and sibling groups are independent keyed states. Recursive checks affect eligible loaded descendants; unloaded possible descendants keep the result mixed until completeness is known, and newly loaded children inherit a checked parent choice. Collapsed subtrees are not entered during visible projection and are absent from the DOM.

## Async, editing, and authorization

Node loads, provider queries, details, mutations, snapshots, summaries, and PDF output use generation checks and operation-local `AbortController`s. Collapse, reload, removal, data/query replacement, and unmount invalidate relevant work. Lazy pages deduplicate first-wins by key, empty results turn a node into a leaf unless `hasMore` remains true, and failures stay local and retryable.

Editing is opt-in (`inline` or `popup`). Add, update, delete, move/reparent, reorder, conflict retry, and conflict reload call immutable host contexts. The default is pessimistic; `optimistic` projects update drafts while a save is pending, rolls back only the matching operation on failure/conflict/cancellation/stale completion, and reconciles when the host replaces data. Loaded duplicate/self/cycle moves fail locally; incomplete loaded ancestry sets `clientValidationConclusive: false` so the server must validate the full hierarchy. Pointer drag-and-drop is deferred because keyboard structural operations and host-validated persistence are the Phase 21 contract.

Client permissions (`allow*` and `can*`) are presentation only. Provider and mutation implementations must revalidate tenant/company, user and roles, requested fields, node and parent membership, cycle/version rules, query limits, and count/output authorization. Field and query IDs require allowlists. Never translate client filter state into raw SQL, member paths, expressions, or executable predicates. Hidden columns and disabled commands are not authorization.

## Scale, output, and state

- Root paging composes `CgPager`; per-parent paging is exposed through `loadMoreChildren`.
- Row virtualization is fixed-height with overscan. Column virtualization retains fixed start/end columns and virtualizes the middle range. Variable-height virtualization is intentionally deferred.
- Grouping is inside each sibling collection and uses `cg-tl-group:` synthetic identities, which cannot collide with real `string:`/`number:` key tokens.
- Visible/loaded/direct-child/loaded-descendant summaries are calculated locally; incomplete trees are explicitly partial. `complete-subtree` requires an authorized `summaryProvider`.
- State version 1 stores column visibility/order/width/fixed region, sibling sorts, filter/mode, sibling groups/collapsed groups, and root/child paging. Invalid versions fall back to usable defaults. `viewStore` always receives explicit company/user/role/view context.
- XLSX supports hierarchy indentation, outline levels, RTL, maximum-row guards, cancellation through snapshots, and formula-safe inline text. A complete-tree export fails when loaded data is incomplete unless `snapshotProvider` supplies an authorized complete result.
- Printing uses a dedicated hierarchy table. PDF is an optional browser-neutral `pdfExporter` callback over an immutable authorized document; the server-specific QuestPDF runtime is not a React dependency.

## Accessibility, SSR, RTL, and actions

The component renders `treegrid`, `row`, `columnheader`, and `gridcell` roles with row/column counts, levels, visible sibling position/set size, expanded/selected/busy/disabled states, mixed checkboxes, and one roving cell tab stop. One delegated handler implements Up/Down, Home/End, PageUp/PageDown, Enter/Space, Ctrl/Cmd+A, F2/Escape, and physical hierarchy Left/Right in both LTR and RTL.

Render is deterministic and does not access browser globals, storage, observers, or measurements. Browser work starts in effects and is cleaned up; multiple Strict Mode instances remain independent. Styles use logical properties and existing tokens, with dark, compact, forced-colors, reduced-motion, 400% zoom, sticky headers, narrow horizontal scrolling, and Arabic RTL coverage.

`actionsRef` is stable for the mounted instance and covers focus/scroll, expansion/path resolution, selection/checks, node and root loading, editing and structure, filter/group/columns, details, XLSX/print/PDF, refresh/batching, and immutable projection/snapshot inspection. Unknown keys return `false`/`null` rather than throwing.
