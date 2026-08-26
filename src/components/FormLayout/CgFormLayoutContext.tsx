import { createContext, useContext } from 'react';
import type { CgDirection, CgSizeMode } from '../../types';
import type { CgFormLayoutCaptionPosition } from './CgFormLayout.types';

export interface CgFormLayoutContextValue {
  captionPosition: CgFormLayoutCaptionPosition;
  captionWidth: string | number;
  size: CgSizeMode;
  direction: CgDirection;
}

export const CgFormLayoutContext = createContext<CgFormLayoutContextValue | undefined>(undefined);

export function useCgFormLayoutContext(): CgFormLayoutContextValue {
  return useContext(CgFormLayoutContext) ?? { captionPosition: 'vertical', captionWidth: '10rem', size: 'medium', direction: 'auto' };
}
