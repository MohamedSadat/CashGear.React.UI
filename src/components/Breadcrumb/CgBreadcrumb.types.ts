import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

export interface CgBreadcrumbItem<TData = unknown> {
  /** Stable identity, such as a page id. */
  key: string;
  /** The crumb's text; drawn with `dir="auto"`, so a name keeps its own direction. */
  text: string;
  /** A link. Without one the crumb is plain text, such as a section name. */
  href?: string;
  /** Drawn before the text, such as a page's emoji or a `CgIcon`. Decoration only. */
  icon?: ReactNode;
  disabled?: boolean;
  data?: TData;
}

export interface CgBreadcrumbNavigateDetails<TData = unknown> {
  readonly item: CgBreadcrumbItem<TData>;
  /** `trail`: a crumb in the line. `overflow`: an item of the menu of hidden crumbs. */
  readonly source: 'trail' | 'overflow';
  readonly event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgBreadcrumbProps<TData = unknown> extends Omit<HTMLAttributes<HTMLElement>,
  'children' | 'aria-label' | 'dangerouslySetInnerHTML'> {
  /** From the root to the current page, which is the last and is marked `aria-current="page"`. */
  items: ReadonlyArray<CgBreadcrumbItem<TData>>;
  /** The navigation landmark's name, such as "Breadcrumbs". */
  label: string;
  /**
   * More crumbs than this collapse: the first `itemsBeforeCollapse` and the last
   * `itemsAfterCollapse` stay, and a "…" button between them lists the rest. Default: never collapse.
   */
  maxItems?: number;
  /** Default 1. */
  itemsBeforeCollapse?: number;
  /** Counts the current page. Default 2. */
  itemsAfterCollapse?: number;
  /** The "…" button's accessible name and tooltip, such as "Show 3 more pages". Needed when `maxItems` is set. */
  overflowLabel?: string | ((hidden: ReadonlyArray<CgBreadcrumbItem<TData>>) => string);
  /** Between crumbs. Default: a chevron that points along the line. */
  separator?: ReactNode;
  /**
   * A crumb or a hidden crumb was chosen. Call `event.preventDefault()` to route without the
   * browser following `href`.
   */
  onNavigate?: (details: CgBreadcrumbNavigateDetails<TData>) => void;
  /** Draws the current page as a link too (its `href`), still marked current. */
  currentLinked?: boolean;
}
