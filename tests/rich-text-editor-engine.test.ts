import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  create,
  type RichTextEditorBridge,
  type RichTextEditorController,
  type RichTextEditorOptions,
  type RichTextEditorState,
} from '../src/vendor/rich-text-editor/editor.js';

const options = (overrides: Partial<RichTextEditorOptions> = {}): RichTextEditorOptions => ({
  html: '<p>Initial</p>',
  generation: 0,
  disabled: false,
  readOnly: false,
  placeholder: '',
  inputId: 'engine-editor',
  ariaLabel: 'Engine editor',
  ariaLabelledBy: '',
  ariaDescribedBy: '',
  ariaInvalid: false,
  direction: 'ltr',
  bindValueMode: 'OnInput',
  inputDelay: 20,
  ...overrides,
});

class TestBridge implements RichTextEditorBridge {
  readonly commits: Array<{ html: string; generation: number; sequence: number }> = [];
  readonly states: RichTextEditorState[] = [];
  private readonly onCommit: (html: string) => void | Promise<void>;

  constructor(onCommit: (html: string) => void | Promise<void> = () => undefined) {
    this.onCommit = onCommit;
  }

  invokeMethodAsync(method: 'ReceiveHtmlAsync', html: string, generation: number, sequence: number): Promise<void>;
  invokeMethodAsync(method: 'ReceiveState', state: RichTextEditorState): Promise<void>;
  async invokeMethodAsync(
    method: 'ReceiveHtmlAsync' | 'ReceiveState',
    value: string | RichTextEditorState,
    generation?: number,
    sequence?: number,
  ): Promise<void> {
    if (method === 'ReceiveState') {
      this.states.push(value as RichTextEditorState);
      return;
    }
    const html = value as string;
    this.commits.push({ html, generation: generation ?? -1, sequence: sequence ?? -1 });
    await this.onCommit(html);
  }
}

function harness(bridge = new TestBridge(), initial = options()) {
  const host = document.createElement('div');
  const root = document.createElement('div');
  host.append(root);
  document.body.append(host);
  const controller = create(host, root, bridge, initial);
  return {
    bridge,
    controller,
    editor: host.querySelector<HTMLElement>('.ProseMirror')!,
    dispose() {
      controller.dispose();
      host.remove();
    },
  };
}

const activeControllers: RichTextEditorController[] = [];
let originalRequestAnimationFrame: typeof requestAnimationFrame;
let originalCancelAnimationFrame: typeof cancelAnimationFrame;

beforeAll(() => {
  originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => window.setTimeout(() => callback(performance.now()), 0);
  globalThis.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

afterAll(() => {
  for (const controller of activeControllers) controller.dispose();
  globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
});

describe('rich-text editor vendored engine', () => {
  it('sanitizes initial and external documents and clears history on a new generation', async () => {
    const view = harness(new TestBridge(), options({ html: '<p onclick="bad()">Initial<script>bad()</script></p>' }));
    activeControllers.push(view.controller);
    expect(view.controller.getHtml()).toBe('<p>Initial</p>');

    expect(view.controller.command('link', { url: 'https://example.com' })).toBe(true);
    await view.controller.flush();
    expect(view.controller.getHtml()).toContain('https://example.com');

    view.controller.setOptions(options({ html: '<p>External<img src="data:image/png;base64,bad"></p>', generation: 1 }));
    expect(view.controller.getHtml()).toBe('<p>External</p>');
    view.controller.command('undo');
    expect(view.controller.getHtml()).toBe('<p>External</p>');
    view.dispose();
  });

  it('does not collapse an empty structural table to an empty document', () => {
    const view = harness(new TestBridge(), options({ html: '<table><tbody><tr><td><p></p></td></tr></tbody></table>' }));
    activeControllers.push(view.controller);
    expect(view.controller.getHtml()).toContain('<table');
    view.dispose();
  });

  it('serializes slow callbacks and coalesces without losing the newest document', async () => {
    let releaseFirst: (() => void) | undefined;
    let firstStarted: (() => void) | undefined;
    const first = new Promise<void>((resolve) => { firstStarted = resolve; });
    const pending = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let callCount = 0;
    const bridge = new TestBridge(async () => {
      callCount += 1;
      if (callCount === 1) {
        firstStarted?.();
        await pending;
      }
    });
    const view = harness(bridge);
    activeControllers.push(view.controller);

    view.controller.command('link', { url: 'https://example.com/first' });
    await first;
    view.controller.command('rule');
    releaseFirst?.();
    await view.controller.flush();

    expect(bridge.commits).toHaveLength(2);
    expect(bridge.commits[0]?.sequence).toBe(1);
    expect(bridge.commits[1]?.sequence).toBeGreaterThan(bridge.commits[0]!.sequence);
    expect(bridge.commits[1]?.html).toContain('<hr>');
    view.dispose();
  });

  it('holds commits during IME composition and flushes after composition ends', async () => {
    const view = harness();
    activeControllers.push(view.controller);
    view.editor.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    view.controller.command('rule');
    await view.controller.flush();
    expect(view.bridge.commits).toHaveLength(0);

    view.editor.dispatchEvent(new Event('compositionend', { bubbles: true }));
    await Promise.resolve();
    await view.controller.flush();
    expect(view.bridge.commits.length).toBeGreaterThan(0);
    expect(view.bridge.commits.at(-1)?.html).toContain('<hr>');
    view.dispose();
  });
});
