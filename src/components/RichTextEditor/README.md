# CgRichTextEditor

`CgRichTextEditor` is a sanitized HTML editor with a `CgTabs`/`CgToolbar` ribbon, `CgPopup` insertion dialogs, and a lazily loaded Tiptap 3.31.3 engine.

```tsx
const actions = useRef<CgRichTextEditorActions>(null);

<CgRichTextEditor
  actionsRef={actions}
  value={html}
  onValueChange={setHtml}
  commitMode="debounced"
  inputDelay={500}
  name="notes"
  required
  ariaLabel="Delivery instructions"
/>
```

Null input is empty. Output is always sanitized supported HTML, and an empty document emits `""`. `input`, `debounced`, and `blur` commit modes are serialized by the engine. Slow async `onValueChange` handlers are awaited and newer typing is coalesced rather than lost. The native form proxy updates immediately even while application commits are delayed. `actionsRef.focus()`, `getHtml()`, and `flush()` operate on current browser state; `flush()` awaits pending debounce work and active callbacks.

The Home, Insert, and contextual Table tabs cover headings, fonts, sizes, text/background colors, bold/italic/underline/strike, alignment, lists and indentation, undo/redo, clear formatting, links, URL images, rules, and full row/column/header/merge/split/table deletion. Toolbar and dialog focus preserves the document selection. Controlled binding echoes preserve selection and history; a genuinely different external document increments its generation, replaces content, and clears history. IME composition delays commits.

Read-only content remains selectable and focusable. Disabled content and its form proxy are removed from the tab order/submission. The visually hidden textarea supports `name`, external `form`, `required`, reset, disabled exclusion, and invalid-focus transfer. All visible labels and command captions are localizable through `labels`.

DOMPurify 3.4.14 runs before initial load, external replacement, paste, and output. The allowlist retains documented document/table tags; safe structural attributes; and only color, background color, font family/size, text alignment, and line height styles. Links allow HTTPS, application-relative, `mailto:`, and `tel:`. Images allow HTTPS or application-relative URLs. Files, scripts, handlers, objects, frames, data URLs, HTTP URLs, protocol-relative URLs, and unsafe CSS are discarded. Client sanitization does not replace server-side validation at persistence or rendering boundaries.

Uploads, DOCX/PDF import/export, collaboration, tracked changes, pagination, headers, and footers are excluded. The bundled engine, notices, and SHA-256 manifest live under `src/vendor/rich-text-editor`. Rebuild it only from the pinned toolchain:

```text
cd vendor-src/rich-text-editor
npm ci
npm run build
```

This pins Tiptap 3.31.3, DOMPurify 3.4.14, and esbuild 0.28.2. Normal library builds consume the checked-in bundle and do not install the nested toolchain.
