import type { ReactNode } from 'react';
import { CgIcon } from '../components/Icon';
import type { CgIconSource } from '../types';

export function renderIcon(source: CgIconSource | undefined, label?: string): ReactNode {
  if (!source) return null;
  return typeof source === 'string' ? <CgIcon name={source} label={label} /> : source;
}
