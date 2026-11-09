/** Key tips as Office shows them: a short code of letters or digits on each command. */

/** Upper-case letters and digits from a command's text, in order. */
function codeCharacters(text: string) {
  return [...text.toUpperCase()].filter((character) => /[A-Z0-9]/.test(character));
}

/** Whether a tip can sit beside the others: equal to none, and neither starts another. */
function fits(tip: string, taken: ReadonlySet<string>) {
  for (const other of taken) {
    if (other === tip || other.startsWith(tip) || tip.startsWith(other)) return false;
  }
  return true;
}

/** The tips to try for a command, in Office's order of preference. */
function candidates(text: string, prefix?: string) {
  const letters = codeCharacters(text);
  const words = text.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const out: string[] = [];
  if (prefix) {
    for (const letter of letters) out.push(prefix + letter);
    for (let digit = 1; digit <= 9; digit++) out.push(prefix + digit);
  }
  const first = letters[0];
  if (first) out.push(first);
  if (words.length > 1) out.push(words[0]!.charAt(0) + words[1]!.charAt(0));
  if (first) {
    for (const next of letters.slice(1)) out.push(first + next);
  }
  // Another of its letters alone, where its first is taken.
  for (const letter of letters.slice(1)) out.push(letter);
  for (const a of letters) for (let digit = 1; digit <= 9; digit++) out.push(a + digit);
  // Anything at all, for a command whose text gives nothing that fits.
  for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') out.push('Y' + a + b);
  }
  return out;
}

export interface KeyTipEntry {
  id: string;
  /** What the command's text says, for a tip of its own when it's given none. */
  text: string;
  /** The tip it's given, if any. */
  keyTip?: string;
  /** What a tip made for it starts with, such as Z for a collapsed group. */
  prefix?: string;
}

/**
 * Gives each entry a tip: the one it asks for, or else one made from its text that neither equals
 * nor starts another, so typing a tip always finds one command. A made tip is never one of
 * `reserved`, letters kept for others' prefixes.
 */
export function assignKeyTips(entries: ReadonlyArray<KeyTipEntry>, reserved: ReadonlyArray<string> = []): Map<string, string> {
  const result = new Map<string, string>();
  const taken = new Set<string>();
  for (const entry of entries) {
    const tip = entry.keyTip?.trim().toUpperCase();
    if (!tip) continue;
    result.set(entry.id, tip);
    taken.add(tip);
  }
  for (const entry of entries) {
    if (result.has(entry.id)) continue;
    const tip = candidates(entry.text, entry.prefix).find((candidate) => !reserved.includes(candidate) && fits(candidate, taken));
    if (!tip) continue;
    result.set(entry.id, tip);
    taken.add(tip);
  }
  return result;
}

/** What typing `typed` does among these tips: activate one, wait for more, or nothing. */
export function matchKeyTip(typed: string, tips: Iterable<string>): { exact: string | null; more: boolean } {
  let exact: string | null = null;
  let more = false;
  for (const tip of tips) {
    if (tip === typed) exact = tip;
    else if (tip.startsWith(typed)) more = true;
  }
  return { exact, more };
}
