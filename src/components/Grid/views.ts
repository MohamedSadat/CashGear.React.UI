/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion -- async interface parity keeps browser and server stores interchangeable. */
import type { CgGridState, CgGridStoredView, CgGridViewCatalog, CgGridViewContext, CgGridViewEntry, CgGridViewSaveRequest, CgGridViewStore } from './CgGrid.types';

interface BrowserEnvelope<TState> { readonly defaultViewId?: string; readonly views: ReadonlyArray<CgGridStoredView<TState> & { readonly schemaSignature: string }> }

function uuid(): string { return globalThis.crypto?.randomUUID?.() ?? `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
function abort(signal: AbortSignal): void { if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError'); }
// Sets and maps (TreeList state holds both) are written as arrays; state normalization rebuilds them.
function storable(_key: string, value: unknown): unknown { return value instanceof Set ? [...value] : value instanceof Map ? [...value.entries()] : value; }

export class CgGridViewConcurrencyError extends Error {}

/** Personal named views in `localStorage`, shared by Grid and TreeList. */
export class BrowserViewStore<TState> implements CgGridViewStore<TState> {
  readonly #storage?: Storage;
  readonly #prefix: string;
  readonly #component: string;
  readonly #noun: string;
  constructor(storage: Storage | undefined, prefix: string, component: string, noun: string) { this.#storage = storage; this.#prefix = prefix; this.#component = component; this.#noun = noun; }
  #getStorage(): Storage { const storage = this.#storage ?? (typeof globalThis.localStorage === 'object' ? globalThis.localStorage : undefined); if (!storage) throw new Error(`${this.#component} browser views require localStorage, which is unavailable in this environment.`); return storage; }
  #key(context: CgGridViewContext): string { return `${this.#prefix}:${context.viewKey}`; }
  #read(context: CgGridViewContext): BrowserEnvelope<TState> { try { const raw = this.#getStorage().getItem(this.#key(context)); const parsed = raw ? JSON.parse(raw) as BrowserEnvelope<TState> : null; return parsed && Array.isArray(parsed.views) ? parsed : { views: [] }; } catch { return { views: [] }; } }
  #write(context: CgGridViewContext, envelope: BrowserEnvelope<TState>): void { this.#getStorage().setItem(this.#key(context), JSON.stringify(envelope, storable)); }
  async getCatalog(context: CgGridViewContext, signal: AbortSignal): Promise<CgGridViewCatalog> { abort(signal); const envelope = this.#read(context); return { views: envelope.views.filter((stored) => stored.schemaSignature === context.schemaSignature).map(({ view }) => ({ ...view, canEdit: true })).sort((a, b) => a.name.localeCompare(b.name)), defaultViewId: envelope.defaultViewId }; }
  async load(context: CgGridViewContext, viewId: string, signal: AbortSignal): Promise<CgGridStoredView<TState> | null> { abort(signal); const stored = this.#read(context).views.find((candidate) => candidate.view.viewId === viewId && candidate.schemaSignature === context.schemaSignature); return stored ? { view: { ...stored.view, canEdit: true }, state: stored.state } : null; }
  async save(context: CgGridViewContext, request: CgGridViewSaveRequest<TState>, signal: AbortSignal): Promise<CgGridStoredView<TState>> {
    abort(signal); if (request.scope !== 'personal') throw new Error(`${this.#component}BrowserViewStore supports personal views only.`); const name = request.name.trim(); if (!name || name.length > 100) throw new Error(`${this.#noun} view name must contain 1 to 100 characters.`);
    const envelope = this.#read(context); if (envelope.views.some((stored) => stored.view.viewId !== request.viewId && stored.view.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error(`A ${this.#noun} view named '${name}' already exists.`);
    const existing = request.viewId ? envelope.views.find((stored) => stored.view.viewId === request.viewId) : undefined;
    if (existing && existing.view.concurrencyToken !== request.concurrencyToken) throw new CgGridViewConcurrencyError(`The ${this.#noun} view changed in another session. Reload it before saving.`);
    const view: CgGridViewEntry = { viewId: existing?.view.viewId ?? uuid(), name, scope: 'personal', canEdit: true, concurrencyToken: uuid() };
    const stored = { view, state: request.state, schemaSignature: context.schemaSignature }; const views = existing ? envelope.views.map((candidate) => candidate === existing ? stored : candidate) : [...envelope.views, stored]; this.#write(context, { ...envelope, views }); return { view, state: request.state };
  }
  async delete(context: CgGridViewContext, viewId: string, token: string | undefined, signal: AbortSignal): Promise<void> { abort(signal); const envelope = this.#read(context); const existing = envelope.views.find((stored) => stored.view.viewId === viewId); if (!existing) return; if (token && existing.view.concurrencyToken !== token) throw new CgGridViewConcurrencyError(`The ${this.#noun} view changed in another session.`); this.#write(context, { defaultViewId: envelope.defaultViewId === viewId ? undefined : envelope.defaultViewId, views: envelope.views.filter((stored) => stored !== existing) }); }
  async setDefault(context: CgGridViewContext, viewId: string | undefined, signal: AbortSignal): Promise<void> { abort(signal); const envelope = this.#read(context); if (viewId && !envelope.views.some((stored) => stored.view.viewId === viewId)) throw new Error(`The selected ${this.#noun} view is unavailable.`); this.#write(context, { ...envelope, defaultViewId: viewId }); }
  async resetDefault(context: CgGridViewContext, signal: AbortSignal): Promise<void> { return this.setDefault(context, undefined, signal); }
}

export class CgGridBrowserViewStore extends BrowserViewStore<CgGridState> {
  constructor(storage?: Storage) { super(storage, 'cg.grid.views', 'CgGrid', 'Grid'); }
}

export function gridSchemaSignature(columns: ReadonlyArray<{ readonly fieldId: string; readonly type: string; readonly formerFieldIds?: ReadonlyArray<string> }>): string { return columns.map((column) => `${column.fieldId}:${column.type}:${(column.formerFieldIds ?? []).join(',')}`).join('|'); }
export function parseStoredGridState(value: unknown): Partial<CgGridState> | null { return value && typeof value === 'object' ? value as Partial<CgGridState> : null; }
