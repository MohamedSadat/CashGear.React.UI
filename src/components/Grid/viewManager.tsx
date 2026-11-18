/* eslint-disable react-hooks/set-state-in-effect -- the injected external view store is synchronized on identity changes. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CgButton } from '../Button';
import { CgPopup } from '../Popup';
import { CgTextBox } from '../TextBox';
import type { CgGridLabels, CgGridViewCatalog, CgGridViewScope, CgGridViewStore } from './CgGrid.types';

/** The view manager's visible text. Grid passes its own labels; TreeList passes its view labels. */
export type CgGridViewManagerLabels = Pick<CgGridLabels, 'views' | 'viewsTitle' | 'view' | 'viewName' | 'viewScope' | 'viewRole' | 'systemDefaultView' | 'personalView' | 'roleView' | 'companyView' | 'saveNewView' | 'updateView' | 'makeDefaultView' | 'deleteView' | 'resetSystemView'>;

export interface CgViewManagerProps<TState> {
  readonly viewKey: string;
  /** Identifies the column set; views saved for another set are not offered. */
  readonly schemaSignature: string;
  readonly store: CgGridViewStore<TState>;
  /** The state a saved view keeps, read when the user saves. */
  readonly getState: () => TState;
  readonly allowShared: boolean;
  readonly labels: CgGridViewManagerLabels;
  readonly onApply: (state: TState) => void;
  /** Called with `null` when the user goes back to the system default. */
  readonly onReset?: () => void;
}

/** Named views with scopes and a default, over any `CgGridViewStore`. Shared by Grid and TreeList. */
export function CgViewManager<TState>({ viewKey, schemaSignature, store, getState, allowShared, labels, onApply, onReset }: CgViewManagerProps<TState>) {
  const context = useMemo(() => ({ viewKey, schemaSignature }), [schemaSignature, viewKey]);
  const [catalog, setCatalog] = useState<CgGridViewCatalog>({ views: [] }); const [selected, setSelected] = useState<string>(''); const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [scope, setScope] = useState<CgGridViewScope>('personal'); const [roleName, setRoleName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const defaultApplied = useRef(false);
  const refresh = async (signal = new AbortController().signal) => { const next = await store.getCatalog(context, signal); setCatalog(next); if (!defaultApplied.current && next.defaultViewId) { defaultApplied.current = true; const stored = await store.load(context, next.defaultViewId, signal); if (stored) { setSelected(stored.view.viewId); setName(stored.view.name); onApply(stored.state); } } };
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal).catch((reason) => { if (!controller.signal.aborted) setError(String(reason instanceof Error ? reason.message : reason)); }); return () => controller.abort(); }, [context, store]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedEntry = catalog.views.find((view) => view.viewId === selected);
  const scopeText = (value: CgGridViewScope) => value === 'company' ? labels.companyView : value === 'role' ? labels.roleView : labels.personalView;
  const run = async (operation: (signal: AbortSignal) => PromiseLike<void>) => { const controller = new AbortController(); setBusy(true); setError(''); try { await operation(controller.signal); await refresh(controller.signal); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  const load = async (id: string) => run(async (signal) => { setSelected(id); if (!id) { onReset?.(); return; } const stored = await store.load(context, id, signal); if (stored) { setName(stored.view.name); setScope(stored.view.scope); setRoleName(stored.view.roleName ?? ''); onApply(stored.state); } });
  const save = async (update: boolean) => run(async (signal) => { const stored = await store.save(context, { viewId: update ? selectedEntry?.viewId : undefined, name, scope, roleName: scope === 'role' ? roleName : undefined, state: getState(), concurrencyToken: update ? selectedEntry?.concurrencyToken : undefined }, signal); setSelected(stored.view.viewId); });
  return <>
    <CgButton size="small" appearance="outline" onClick={() => setOpen(true)}>{labels.views}</CgButton>
    <CgPopup open={open} onOpenChange={setOpen} headerText={labels.viewsTitle} width="min(32rem, 94vw)">
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {error ? <div role="alert">{error}</div> : null}
        <label>{labels.view}<select value={selected} disabled={busy} onChange={(event) => void load(event.currentTarget.value)}><option value="">{labels.systemDefaultView}</option>{catalog.views.map((view) => <option key={view.viewId} value={view.viewId}>{view.name} ({scopeText(view.scope)})</option>)}</select></label>
        <label>{labels.viewName}<CgTextBox value={name} onValueChange={setName} fullWidth /></label>
        {allowShared ? <label>{labels.viewScope}<select value={scope} onChange={(event) => setScope(event.currentTarget.value as CgGridViewScope)}><option value="personal">{labels.personalView}</option><option value="role" disabled={!catalog.canManageSharedViews}>{labels.roleView}</option><option value="company" disabled={!catalog.canManageSharedViews}>{labels.companyView}</option></select></label> : null}
        {scope === 'role' ? <label>{labels.viewRole}<select value={roleName} onChange={(event) => setRoleName(event.currentTarget.value)}>{(catalog.shareableRoles ?? []).map((role) => <option key={role}>{role}</option>)}</select></label> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <CgButton size="small" onClick={() => void save(false)} disabled={busy || !name.trim()}>{labels.saveNewView}</CgButton>
          <CgButton size="small" appearance="outline" onClick={() => void save(true)} disabled={busy || !selectedEntry?.canEdit || !name.trim()}>{labels.updateView}</CgButton>
          <CgButton size="small" appearance="outline" onClick={() => void run((signal) => store.setDefault(context, selected || undefined, signal))} disabled={busy}>{labels.makeDefaultView}</CgButton>
          <CgButton size="small" intent="danger" appearance="outline" onClick={() => void run(async (signal) => { if (!selectedEntry) return; await store.delete(context, selectedEntry.viewId, selectedEntry.concurrencyToken, signal); setSelected(''); setName(''); })} disabled={busy || !selectedEntry?.canEdit}>{labels.deleteView}</CgButton>
          <CgButton size="small" appearance="outline" onClick={() => void run((signal) => store.resetDefault(context, signal))} disabled={busy}>{labels.resetSystemView}</CgButton>
        </div>
      </div>
    </CgPopup>
  </>;
}
