import type { ReactNode } from 'react';

/**
 * Puts the host's language on the built-in labels of CashGear components: a
 * grid's search box and context menu, a popup's close button, a pager and so
 * on. Mirrors Blazor's `ICgUiText`.
 *
 * Text a page passes to a component is never sent here; it is used as it is.
 */
export interface CgUiText {
  /**
   * Returns `text` in the current UI language, or unchanged when there is no
   * translation. `text` is the English default and can be a format such as
   * `Page {0} of {1}`; a translated format must keep the same placeholders.
   */
  translate(text: string): string;
}

export interface CgUiTextProviderProps {
  /** Translates one English default. Without a provider every component keeps its English text. */
  translate: (text: string) => string;
  children?: ReactNode;
}
