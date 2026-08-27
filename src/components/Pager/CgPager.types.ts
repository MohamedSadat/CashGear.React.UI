import type { ReactNode, Ref } from 'react';
import type { CgBaseProps, CgDensity, CgDirection, CgSizeMode } from '../../types';
import type { CgPagerItemRange, CgPagerWindow } from './paging';

export type CgPagerMode = 'auto' | 'numericButtons' | 'inputBox' | 'pageStatus';
export type CgPagerNavigationReason = 'numericButton' | 'firstButton' | 'previousButton' | 'nextButton' | 'lastButton' | 'inputCommit' | 'keyboard' | 'programmatic' | 'pageCountClamp';

export interface CgPagerNavigationDetails {
  readonly previousPageIndex: number;
  readonly pageIndex: number;
  readonly reason: CgPagerNavigationReason;
}

export interface CgPagerPageSizeChangeDetails {
  readonly previousPageSize: number;
  readonly pageSize: number;
  readonly previousPageIndex: number;
  readonly pageIndex: number;
  readonly preserveFirstVisibleItem: boolean;
}

export interface CgPagerSummaryContext {
  readonly pageIndex: number;
  readonly displayPageNumber: number;
  readonly pageCount: number;
  readonly totalItemCount?: number;
  readonly range: CgPagerItemRange;
  readonly pageSize: number;
}

export interface CgPagerButtonContext {
  readonly pageIndex: number;
  readonly displayPageNumber: number;
  readonly active: boolean;
  readonly disabled: boolean;
  readonly accessibleLabel: string;
  readonly navigate: () => void;
}

export interface CgPagerLabels {
  readonly navigation: string;
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;
  readonly goToPage: string;
  readonly currentPage: string;
  readonly pageOf: string;
  readonly itemsOf: string;
  readonly pageSize: string;
  readonly invalidPageNumber: string;
  readonly noItems: string;
  readonly page: string;
  readonly of: string;
  readonly totalRecords: string;
}

export interface CgPagerActions {
  readonly focus: () => void;
  readonly goToPage: (pageIndex: number) => boolean;
  readonly goToFirstPage: () => boolean;
  readonly goToLastPage: () => boolean;
  readonly goToPreviousPage: () => boolean;
  readonly goToNextPage: () => boolean;
  readonly setPageSize: (pageSize: number) => boolean;
  readonly getPageIndex: () => number;
  readonly getPageCount: () => number;
}

export interface CgPagerProps extends CgBaseProps {
  readonly pageIndex?: number;
  readonly defaultPageIndex?: number;
  readonly onPageIndexChange?: (pageIndex: number, details: CgPagerNavigationDetails) => void;
  readonly pageSize?: number;
  readonly defaultPageSize?: number;
  readonly onPageSizeChange?: (pageSize: number, details: CgPagerPageSizeChangeDetails) => void;
  readonly pageCount?: number;
  readonly totalItemCount?: number;
  readonly mode?: CgPagerMode;
  readonly visibleNumericButtonCount?: number;
  readonly switchToInputBoxPageCount?: number;
  readonly minimumNumericWidth?: number;
  readonly showFirstButton?: boolean;
  readonly showPreviousButton?: boolean;
  readonly showNextButton?: boolean;
  readonly showLastButton?: boolean;
  readonly autoHideNavigationButtons?: boolean;
  readonly showPageSizeSelector?: boolean;
  readonly pageSizeOptions?: ReadonlyArray<number>;
  readonly showSummary?: boolean;
  readonly preserveFirstVisibleItemOnPageSizeChange?: boolean;
  readonly disableNavigationWhileLoading?: boolean;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly renderSummary?: (context: CgPagerSummaryContext) => ReactNode;
  readonly renderNumericButton?: (context: CgPagerButtonContext) => ReactNode;
  readonly labels?: Partial<CgPagerLabels>;
  readonly navigationLabel?: string;
  readonly size?: CgSizeMode;
  readonly density?: CgDensity;
  readonly direction?: CgDirection;
  readonly layout?: 'responsive' | 'compact';
  readonly actionsRef?: Ref<CgPagerActions>;
  readonly onInvalidInput?: (draft: string) => void;
}

export type { CgPagerItemRange, CgPagerWindow };
