import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface CgGridLayoutRowDescriptor {
  height?: string;
  /** Space-separated named areas; use a dot for an empty cell. */
  areas?: string;
}

export interface CgGridLayoutColumnDescriptor {
  width?: string;
}

export interface CgGridLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  rows?: ReadonlyArray<CgGridLayoutRowDescriptor>;
  columns?: ReadonlyArray<CgGridLayoutColumnDescriptor>;
  rowGap?: CSSProperties['rowGap'];
  columnGap?: CSSProperties['columnGap'];
  children?: ReactNode;
}

export interface CgGridLayoutItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  row?: number;
  column?: number;
  rowSpan?: number;
  columnSpan?: number;
  area?: string;
  visible?: boolean;
  children?: ReactNode;
}
