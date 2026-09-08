import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';

export interface CgEditorActions {
  flush(): Promise<boolean>;
  resetDraft(): void;
}
export interface CgEditorCommitApi {
  flush(): Promise<boolean>;
  commit(validate?: () => boolean | PromiseLike<boolean>): Promise<boolean>;
  resetDrafts(): void;
}
export interface CgEditorCommitController extends CgEditorCommitApi {
  register(editor: CgEditorActions): () => void;
}
const Context = createContext<CgEditorCommitController | null>(null);

/** Private controller factory, also used by the data controls for isolated edit sessions. */
export function createEditorCommitController(): CgEditorCommitController {
  const editors = new Set<CgEditorActions>();
  let generation = 0;
  let pending: Promise<boolean> | undefined;
  const flush = (): Promise<boolean> => {
    if (pending) return pending;
    const current = generation;
    const work = async () => {
      for (const editor of [...editors]) {
        if (current !== generation) return false;
        if (editors.has(editor) && !await editor.flush()) return false;
        flushSync(() => undefined);
      }
      return current === generation;
    };
    const operation = work();
    pending = operation;
    void operation.then(() => { if (pending === operation) pending = undefined; }, () => { if (pending === operation) pending = undefined; });
    return operation;
  };
  return {
    register(editor) { editors.add(editor); return () => { editors.delete(editor); generation++; }; },
    flush,
    async commit(validate) { const current = generation; return await flush() && current === generation && (validate ? await validate() && current === generation : true); },
    resetDrafts() { generation++; for (const editor of [...editors]) editor.resetDraft(); },
  };
}
export function useEditorCommitController(): CgEditorCommitController {
  return useMemo(() => createEditorCommitController(), []);
}
export function CgEditorCommitProvider({ children, controller }: { children?: ReactNode; controller?: CgEditorCommitController }) {
  const own = useEditorCommitController();
  return <Context.Provider value={controller ?? own}>{children}</Context.Provider>;
}
export function useCgEditorCommit(): CgEditorCommitApi {
  const context = useContext(Context);
  if (!context) throw new Error('useCgEditorCommit requires CgEditorCommitProvider.');
  return context;
}
export function useEditorRegistration(editor: CgEditorActions) {
  const context = useContext(Context);
  const latest = useRef(editor);
  useLayoutEffect(() => { latest.current = editor; });
  useLayoutEffect(() => context?.register({ flush: () => latest.current.flush(), resetDraft: () => latest.current.resetDraft() }), [context]);
}
