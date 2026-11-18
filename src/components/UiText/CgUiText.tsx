import { createContext, useContext, useMemo } from 'react';
import type { CgUiText, CgUiTextProviderProps } from './CgUiText.types';

const IDENTITY: CgUiText = { translate: (text) => text };
const CgUiTextContext = createContext<CgUiText>(IDENTITY);

/**
 * Gives every CashGear component below it the host's translation of its
 * built-in English labels. Labels a page passes as props are never translated:
 * they win over the defaults, even when they equal the English text.
 */
export function CgUiTextProvider({ translate, children }: CgUiTextProviderProps) {
  const value = useMemo<CgUiText>(() => ({
    translate: (text) => {
      if (!text) return text;
      const translated = translate(text);
      return typeof translated === 'string' && translated.length > 0 ? translated : text;
    },
  }), [translate]);
  return <CgUiTextContext.Provider value={value}>{children}</CgUiTextContext.Provider>;
}

/** The nearest `CgUiTextProvider`'s translator, or one that returns text unchanged. */
export function useCgUiText(): CgUiText {
  return useContext(CgUiTextContext);
}
