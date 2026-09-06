export interface RichTextEditorState {
  enabled: Record<string, boolean>;
  active: Record<string, boolean>;
  inTable: boolean;
  words: number;
  characters: number;
  fontFamily: string;
  fontSize: string;
  color: string;
  highlight: string;
  heading: string;
}

export interface RichTextEditorOptions {
  html: string;
  generation: number;
  disabled: boolean;
  readOnly: boolean;
  placeholder: string;
  inputId: string;
  ariaLabel: string;
  ariaLabelledBy: string;
  ariaDescribedBy: string;
  ariaInvalid: boolean;
  direction: 'ltr' | 'rtl';
  bindValueMode: 'OnInput' | 'OnDelayedInput' | 'OnLostFocus';
  inputDelay: number;
}

export interface RichTextEditorBridge {
  invokeMethodAsync(method: 'ReceiveHtmlAsync', html: string, generation: number, sequence: number): Promise<void>;
  invokeMethodAsync(method: 'ReceiveState', state: RichTextEditorState): Promise<void>;
}

export interface RichTextEditorController {
  setOptions(options: RichTextEditorOptions): void;
  command(name: string, value?: unknown): boolean;
  getLink(): string;
  validateUrl(value: string, image?: boolean): boolean;
  getHtml(): string;
  flush(): Promise<void>;
  focus(): void;
  dispose(): void;
}

export function safeUrl(value: string, image?: boolean): boolean;
export function sanitize(html: string | null | undefined): string;
export function create(
  host: HTMLElement,
  root: HTMLElement,
  bridge: RichTextEditorBridge,
  options: RichTextEditorOptions,
): RichTextEditorController;
