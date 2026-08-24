import type { ChangeEvent } from 'react';
import type { CgEditorButtonDescriptor } from '../../types';
import type { CgTextBoxProps } from '../TextBox';

export type CgSearchMode = 'input' | 'debounced' | 'blur' | 'submit';
export type CgSearchReason = 'input' | 'debounce' | 'blur' | 'submit' | 'clear';
export interface CgSearchContext { reason: CgSearchReason; requestId: number; signal: AbortSignal; }
export interface CgSearchBoxProps extends Omit<CgTextBoxProps, 'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'type' | 'buttons' | 'passwordReveal'> {
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string, event?: ChangeEvent<HTMLInputElement>) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onSearch?: (query: string, context: CgSearchContext) => void | Promise<void>;
  searchMode?: CgSearchMode;
  searchDelay?: number;
  minimumLength?: number;
  escapeClears?: boolean;
  loading?: boolean;
  loadingText?: string;
  resultStatus?: string;
  searchAriaLabel?: string;
  commands?: ReadonlyArray<CgEditorButtonDescriptor<string>>;
}
