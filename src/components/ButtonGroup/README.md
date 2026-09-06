# CgButtonGroup

`CgButtonGroup<TData>` composes `CgButton` instances into a connected command or selection surface. Items are immutable descriptors with stable, unique `name` values.

```tsx
<CgButtonGroup
  selectionMode="single"
  selectedName={view}
  onSelectedNameChange={setView}
  ariaLabel="Invoice view"
  items={[{ name: 'list', text: 'List' }, { name: 'map', text: 'Map' }]}
/>
```

`selectionMode` is a discriminant. `none` accepts no selection binding, `single` accepts `selectedName`/`defaultSelectedName`, and `multiple` accepts immutable `selectedNames`/`defaultSelectedNames`. Controlled values remain authoritative when a proposal is ignored. A selected single item does not clear itself; hidden or disabled selections remain caller-owned.

An item's `onClick` runs before the group's `onItemClick`, followed by the selection proposal. Rejection or an exception calls `onItemError` and leaves selection unchanged. `autoLoading` and duplicate suppression cover asynchronous work. Arrow navigation wraps and skips hidden, disabled, loading, or automatically busy items; horizontal arrows follow computed RTL while vertical arrows remain physical. Home and End move to the eligible endpoints.

Single selection uses `radiogroup`/`radio` and follows arrow focus. Multiple items expose `aria-pressed`; command groups remain native buttons. Custom-rendered or icon-only items require `ariaLabel` or `title`. The React descriptor and discriminated-prop API replaces Razor declaration children and separate irrelevant bindings.
