/** Stop awaiting an uncooperative host without allowing its eventual result to publish. */
export function awaitWithAbort<T>(work: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new DOMException('Operation cancelled.', 'AbortError')); };
    // Always attach handlers, including when cancellation preceded this call.
    void Promise.resolve(work).then((value) => {
      signal.removeEventListener('abort', abort);
      if (!signal.aborted) resolve(value);
    // Preserve the host rejection value for the public diagnostic callback.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    }, (error: unknown) => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
