/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion -- async interface parity keeps browser and server stores interchangeable. */
import type { CgGridState, CgGridStoredView, CgGridViewCatalog, CgGridViewContext, CgGridViewEntry, CgGridViewSaveRequest, CgGridViewStore } from './CgGrid.types';

interface BrowserEnvelope { readonly defaultViewId?: string; readonly views: ReadonlyArray<CgGridStoredView & { readonly schemaSignature: string }> }

function uuid(): string { return globalThis.crypto?.randomUUID?.() ?? `cg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
function abort(signal: AbortSignal): void { if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError'); }

export class CgGridViewConcurrencyError extends Error {}

export class CgGridBrowserViewStore implements CgGridViewStore {
  readonly #storage?: Storage;
  constructor(storage?: Storage) { this.#storage = storage; }
  #getStorage(): Storage { const storage = this.#storage ?? (typeof globalThis.localStorage === 'object' ? globalThis.localStorage : undefined); if (!storage) throw new Error('CgGrid browser views require localStorage, which is unavailable in this environment.'); return storage; }
  #key(context: CgGridViewContext): string { return `cg.grid.views:${context.viewKey}`; }
  #read(context: CgGridViewContext): BrowserEnvelope { try { const raw = this.#getStorage().getItem(this.#key(context)); const parsed = raw ? JSON.parse(raw) as BrowserEnvelope : null; return parsed && Array.isArray(parsed.views) ? parsed : { views: [] }; } catch { return { views: [] }; } }
  #write(context: CgGridViewContext, envelope: BrowserEnvelope): void { this.#getStorage().setItem(this.#key(context), JSON.stringify(envelope)); }
  async getCatalog(context: CgGridViewContext, signal: AbortSignal): Promise<CgGridViewCatalog> { abort(signal); const envelope = this.#read(context); return { views: envelope.views.filter((stored) => stored.schemaSignature === context.schemaSignature).map(({ view }) => ({ ...view, canEdit: true })).sort((a, b) => a.name.localeCompare(b.name)), defaultViewId: envelope.defaultViewId }; }
  async load(context: CgGridViewContext, viewId: string, signal: AbortSignal): Promise<CgGridStoredView | null> { abort(signal); const stored = this.#read(context).views.find((candidate) => candidate.view.viewId === viewId && candidate.schemaSignature === context.schemaSignature); return stored ? { view: { ...stored.view, canEdit: true }, state: stored.state } : null; }
  async save(context: CgGridViewContext, request: CgGridViewSaveRequest, signal: AbortSignal): Promise<CgGridStoredView> {
    abort(signal); if (request.scope !== 'personal') throw new Error('CgGridBrowserViewStore supports personal views only.'); const name = request.name.trim(); if (!name || name.length > 100) throw new Error('Grid view name must contain 1 to 100 characters.');
    const envelope = this.#read(context); if (envelope.views.some((stored) => stored.view.viewId !== request.viewId && stored.view.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error(`A Grid view named '${name}' already exists.`);
    const existing = request.viewId ? envelope.views.find((stored) => stored.view.viewId === request.viewId) : undefined;
    if (existing && existing.view.concurrencyToken !== request.concurrencyToken) throw new CgGridViewConcurrencyError('The Grid view changed in another session. Reload it before saving.');
    const view: CgGridViewEntry = { viewId: existing?.view.viewId ?? uuid(), name, scope: 'personal', canEdit: true, concurrencyToken: uuid() };
    const stored = { view, state: request.state, schemaSignature: context.schemaSignature }; const views = existing ? envelope.views.map((candidate) => candidate === existing ? stored : candidate) : [...envelope.views, stored]; this.#write(context, { ...envelope, views }); return { view, state: request.state };
  }
  async delete(context: CgGridViewContext, viewId: string, token: string | undefined, signal: AbortSignal): Promise<void> { abort(signal); const envelope = this.#read(context); const existing = envelope.views.find((stored) => stored.view.viewId === viewId); if (!existing) return; if (token && existing.view.concurrencyToken !== token) throw new CgGridViewConcurrencyError('The Grid view changed in another session.'); this.#write(context, { defaultViewId: envelope.defaultViewId === viewId ? undefined : envelope.defaultViewId, views: envelope.views.filter((stored) => stored !== existing) }); }
  async setDefault(context: CgGridViewContext, viewId: string | undefined, signal: AbortSignal): Promise<void> { abort(signal); const envelope = this.#read(context); if (viewId && !envelope.views.some((stored) => stored.view.viewId === viewId)) throw new Error('The selected Grid view is unavailable.'); this.#write(context, { ...envelope, defaultViewId: viewId }); }
  async resetDefault(context: CgGridViewContext, signal: AbortSignal): Promise<void> { return this.setDefault(context, undefined, signal); }
}

export function gridSchemaSignature(columns: ReadonlyArray<{ readonly fieldId: string; readonly type: string; readonly formerFieldIds?: ReadonlyArray<string> }>): string { return columns.map((column) => `${column.fieldId}:${column.type}:${(column.formerFieldIds ?? []).join(',')}`).join('|'); }
export function parseStoredGridState(value: unknown): Partial<CgGridState> | null { return value && typeof value === 'object' ? value as Partial<CgGridState> : null; }
