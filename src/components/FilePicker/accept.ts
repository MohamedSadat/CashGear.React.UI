/** The tokens of an `accept` value, trimmed and lower-cased; none means any file. */
export function acceptTokens(accept: string | readonly string[] | undefined): string[] {
  if (accept === undefined) return [];
  const list = typeof accept === 'string' ? accept.split(',') : accept.flatMap((token) => token.split(','));
  return list.map((token) => token.trim().toLowerCase()).filter(Boolean);
}

/** Whether a file matches `accept` as a browser's file dialog reads it. */
export function fileMatches(file: Pick<File, 'name' | 'type'>, tokens: readonly string[]): boolean {
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}
