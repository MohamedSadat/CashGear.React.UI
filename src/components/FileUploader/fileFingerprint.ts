const SAMPLE_SIZE = 64 * 1024;

export async function sha256Hex(value: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintFile(file: File, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const first = new Uint8Array(await file.slice(0, Math.min(SAMPLE_SIZE, file.size)).arrayBuffer());
  signal?.throwIfAborted();
  const lastStart = Math.max(first.byteLength, file.size - SAMPLE_SIZE);
  const last = new Uint8Array(await file.slice(lastStart, file.size).arrayBuffer());
  signal?.throwIfAborted();
  const metadata = new TextEncoder().encode(`${file.name}\u001f${file.size}\u001f${file.lastModified}\u001f`);
  const combined = new Uint8Array(metadata.length + first.length + last.length);
  combined.set(metadata); combined.set(first, metadata.length); combined.set(last, metadata.length + first.length);
  return sha256Hex(combined);
}
