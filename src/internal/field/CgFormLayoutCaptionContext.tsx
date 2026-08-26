import { createContext, useContext } from 'react';

export const CgFormLayoutCaptionContext = createContext<string | undefined>(undefined);

export function useCgFormLayoutCaptionId(): string | undefined {
  return useContext(CgFormLayoutCaptionContext);
}
