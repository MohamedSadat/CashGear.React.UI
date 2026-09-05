import type { CSSProperties, ReactNode } from 'react';
import type { CgDateValue, CgDayOfWeek } from '../../types/date';
import type { CgDirection } from '../../types';

export type CgSchedulerView = 'day' | 'workWeek' | 'week' | 'month' | 'timeline';
export type CgSchedulerKey = string | number;
/** ISO 8601 instant with an explicit Z or numeric offset. Callbacks emit UTC. */
export type CgSchedulerInstant = string;
export interface CgSchedulerVisibleRange { startDate: CgDateValue; endDate: CgDateValue; start: CgSchedulerInstant; end: CgSchedulerInstant }
export interface CgSchedulerAppointmentDraft {
  title: string;
  start: CgSchedulerInstant;
  end: CgSchedulerInstant;
  description: string;
  color: string;
  isAllDay: boolean;
}
export type CgSchedulerOperationResult = { success: true } | { success: false; error?: string; fieldErrors?: Partial<Record<keyof CgSchedulerAppointmentDraft, string>> };
export type CgSchedulerInteractionSource = 'editor' | 'timeCell' | 'keyboard' | 'drag' | 'resize';
export interface CgSchedulerOperationRequest<TItem> {
  originalItem: TItem | null;
  original: Readonly<CgSchedulerAppointmentDraft> | null;
  draft: Readonly<CgSchedulerAppointmentDraft>;
  source: CgSchedulerInteractionSource;
  edge?: 'start' | 'end';
}
export type CgSchedulerOperationHandler<TItem> = (request: CgSchedulerOperationRequest<TItem>, signal: AbortSignal) => CgSchedulerOperationResult | Promise<CgSchedulerOperationResult>;
export interface CgSchedulerAppointmentContext<TItem> extends Readonly<CgSchedulerAppointmentDraft> {
  item: TItem;
  id: CgSchedulerKey;
  isSelected: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
  view: CgSchedulerView;
}
export interface CgSchedulerTimeCellContext {
  date: CgDateValue;
  start: CgSchedulerInstant;
  end: CgSchedulerInstant;
  label: string;
  isAllDay: boolean;
  isWorkingTime: boolean;
  isSelected: boolean;
  view: CgSchedulerView;
}
export interface CgSchedulerSelection<TItem> { appointment: TItem | null; appointmentId: CgSchedulerKey | null; slot: CgSchedulerTimeCellContext | null }
export interface CgSchedulerProviderRequest { range: CgSchedulerVisibleRange; view: CgSchedulerView; signal: AbortSignal }
export type CgSchedulerItemsProvider<TItem> = (request: CgSchedulerProviderRequest) => Promise<readonly TItem[]>;
export interface CgSchedulerToolbarContext { selectedDate: CgDateValue; currentView: CgSchedulerView; range: CgSchedulerVisibleRange; navigate: (direction: -1 | 1) => void; today: () => void; changeView: (view: CgSchedulerView) => void; refresh: () => void }
export interface CgSchedulerEditorContext<TItem> { item: TItem | null; draft: CgSchedulerAppointmentDraft; setDraft: (draft: CgSchedulerAppointmentDraft) => void; busy: boolean; fieldErrors: Partial<Record<keyof CgSchedulerAppointmentDraft, string>> }
export interface CgSchedulerHeaderContext { date: CgDateValue; label: string; isToday: boolean; view: CgSchedulerView }
export interface CgSchedulerLabels {
  scheduler: string; previous: string; next: string; today: string; view: string;
  day: string; workWeek: string; week: string; month: string; timeline: string;
  allDay: string; more: (count: number) => string; create: string; edit: string;
  delete: string; deleteConfirmation: string; title: string; start: string; end: string;
  description: string; color: string; save: string; cancel: string; loading: string;
  retry: string; loadError: string; operationError: string; invalidDates: string; requiredTitle: string;
  timeZone: string; resizeStart: string; resizeEnd: string; noAppointments: string;
}
interface CgSchedulerCommonProps<TItem> {
  idSelector: (item: TItem) => CgSchedulerKey;
  titleSelector: (item: TItem) => string | null | undefined;
  startSelector: (item: TItem) => CgSchedulerInstant;
  endSelector: (item: TItem) => CgSchedulerInstant;
  descriptionSelector?: (item: TItem) => string | null | undefined;
  colorSelector?: (item: TItem) => string | null | undefined;
  allDaySelector?: (item: TItem) => boolean;
  cssClassSelector?: (item: TItem) => string | null | undefined;
  selectedDate?: CgDateValue;
  defaultSelectedDate?: CgDateValue;
  onSelectedDateChange?: (date: CgDateValue) => void;
  currentView?: CgSchedulerView;
  defaultCurrentView?: CgSchedulerView;
  onCurrentViewChange?: (view: CgSchedulerView) => void;
  selectedAppointmentId?: CgSchedulerKey | null;
  defaultSelectedAppointmentId?: CgSchedulerKey | null;
  onSelectedAppointmentIdChange?: (id: CgSchedulerKey | null) => void;
  onSelectionChange?: (selection: CgSchedulerSelection<TItem>) => void;
  onVisibleRangeChange?: (range: CgSchedulerVisibleRange, view: CgSchedulerView) => void;
  onAppointmentClick?: (context: CgSchedulerAppointmentContext<TItem>) => void;
  onAppointmentDoubleClick?: (context: CgSchedulerAppointmentContext<TItem>) => void;
  onTimeCellClick?: (context: CgSchedulerTimeCellContext) => void;
  onTimeCellDoubleClick?: (context: CgSchedulerTimeCellContext) => void;
  onAppointmentCreating?: CgSchedulerOperationHandler<TItem>;
  onAppointmentUpdating?: CgSchedulerOperationHandler<TItem>;
  onAppointmentDeleting?: CgSchedulerOperationHandler<TItem>;
  onAppointmentDragging?: CgSchedulerOperationHandler<TItem>;
  onAppointmentResizing?: CgSchedulerOperationHandler<TItem>;
  displayTimeZone?: string;
  locale?: string;
  firstDayOfWeek?: CgDayOfWeek;
  workingDays?: readonly CgDayOfWeek[];
  /** Durations are minutes. Time-of-day values are HH:mm, with 24:00 allowed for ends. */
  timeInterval?: number;
  minimumAppointmentDuration?: number;
  workDayStart?: string;
  workDayEnd?: string;
  visibleDayStart?: string;
  visibleDayEnd?: string;
  showWorkTimeOnly?: boolean;
  dayCount?: number;
  monthCount?: number;
  monthAppointmentLimit?: number;
  timelineDuration?: number;
  timelineScale?: number;
  timelineCellMinWidth?: number;
  readOnly?: boolean;
  disabled?: boolean;
  allowCreateAppointment?: boolean;
  allowEditAppointment?: boolean;
  allowDeleteAppointment?: boolean;
  allowDragAppointment?: boolean;
  allowResizeAppointment?: boolean;
  showCurrentTimeIndicator?: boolean;
  showToolbar?: boolean;
  /** Injectable clock for deterministic rendering; returns an instant. */
  now?: () => CgSchedulerInstant;
  renderAppointment?: (context: CgSchedulerAppointmentContext<TItem>) => ReactNode;
  renderTimeCell?: (context: CgSchedulerTimeCellContext) => ReactNode;
  renderDateHeader?: (context: CgSchedulerHeaderContext) => ReactNode;
  renderToolbar?: (context: CgSchedulerToolbarContext) => ReactNode;
  renderEditor?: (context: CgSchedulerEditorContext<TItem>) => ReactNode;
  labels?: Partial<CgSchedulerLabels>;
  direction?: CgDirection;
  height?: CSSProperties['height'];
  id?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}
export type CgSchedulerProps<TItem> = CgSchedulerCommonProps<TItem> & (
  | { items: readonly TItem[]; itemsProvider?: never }
  | { items?: never; itemsProvider: CgSchedulerItemsProvider<TItem> }
);
