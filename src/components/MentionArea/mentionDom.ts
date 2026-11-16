import type { CgMentionAreaMention, CgMentionAreaValue } from './CgMentionArea.types';

const BLOCKS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'PRE']);

export function mentionAtom(doc: Document, mention: CgMentionAreaMention, className: string): HTMLElement {
  const span = doc.createElement('span');
  span.className = className;
  span.setAttribute('contenteditable', 'false');
  span.dataset.cgMentionKind = mention.kind;
  span.dataset.cgMentionId = mention.id;
  span.textContent = mention.text;
  return span;
}

/** The area's content: text, line breaks (a `<br>`, or a line a browser made a block of) and mention atoms. */
export function readValue(root: Node): CgMentionAreaValue {
  const out: Array<string | CgMentionAreaMention> = [];
  const push = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (typeof last === 'string') out[out.length - 1] = last + text;
    else out.push(text);
  };
  let afterBlock = false;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (afterBlock) { push('\n'); afterBlock = false; }
      if (child.nodeType === 3) { push((child as Text).data); continue; }
      if (!(child instanceof HTMLElement)) continue;
      if (child.dataset.cgMentionId !== undefined) {
        out.push({ kind: child.dataset.cgMentionKind ?? '', id: child.dataset.cgMentionId, text: child.textContent ?? '' });
        continue;
      }
      if (child.tagName === 'BR') { push('\n'); continue; }
      const block = BLOCKS.has(child.tagName);
      if (block && out.length && !afterBlock) {
        const last = out[out.length - 1];
        if (typeof last !== 'string' || !last.endsWith('\n')) push('\n');
      }
      walk(child);
      if (block) afterBlock = true;
    }
  };
  walk(root);
  // A browser leaves a `<br>` in an emptied line: one at the very end is not content.
  const last = out[out.length - 1];
  if (typeof last === 'string' && last.endsWith('\n')) {
    const trimmed = last.slice(0, -1);
    if (trimmed) out[out.length - 1] = trimmed; else out.pop();
  }
  return out;
}

/** Replaces the area's content with `value`. */
export function writeValue(root: HTMLElement, value: CgMentionAreaValue, atomClass: string): void {
  const doc = root.ownerDocument;
  root.replaceChildren();
  for (const part of value) {
    if (typeof part !== 'string') { root.append(mentionAtom(doc, part, atomClass)); continue; }
    part.split('\n').forEach((line, index) => {
      if (index > 0) root.append(doc.createElement('br'));
      if (line) root.append(doc.createTextNode(line));
    });
  }
}

/** The trigger and query being typed at the caret, as "@lay", or null. */
export function queryAt(text: string, caret: number, triggers: readonly string[]): { trigger: string; query: string; start: number } | null {
  const before = text.slice(0, caret);
  for (const trigger of triggers) {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const match = new RegExp(`(?:^|[\\s(])${escaped}([^\\s${escaped}]{0,40})$`, 'u').exec(before);
    if (match) return { trigger, query: match[1]!, start: caret - match[1]!.length - trigger.length };
  }
  return null;
}

export function isEmpty(root: HTMLElement): boolean {
  return !root.textContent && !root.querySelector('[data-cg-mention-id]');
}
