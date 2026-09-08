/** Serializes publication without delaying the first synchronous callback. */
export function createEditorPublication<T>() {
  let generation = 0;
  let pending: Promise<void> | undefined;
  let failed = false;
  const publish = (value: T, callback: (value: T) => void | PromiseLike<void>): Promise<void> => {
    const current = generation;
    const invoke = () => {
      if (current !== generation) return;
      return callback(value);
    };
    let result: void | PromiseLike<void>;
    try { result = pending ? pending.catch(() => undefined).then(invoke) : invoke(); }
    catch (error) { result = Promise.reject(error instanceof Error ? error : new Error('Editor publication failed.', { cause: error })); }
    if (!result || typeof result.then !== 'function') { failed = false; return Promise.resolve(); }
    const operation = Promise.resolve(result).then(() => { if (current === generation) failed = false; }, (error: unknown) => { if (current === generation) failed = true; throw error; });
    pending = operation;
    void operation.then(() => { if (pending === operation) pending = undefined; }, () => { if (pending === operation) pending = undefined; });
    return operation;
  };
  return {
    publish,
    get revision() { return generation; },
    async wait() { await pending; return !failed; },
    reset() { generation++; pending = undefined; failed = false; },
  };
}
