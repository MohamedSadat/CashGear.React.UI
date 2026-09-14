import type { CSSProperties, ReactNode, Ref } from 'react';
import type { CgDateValue, CgDayOfWeek } from '../../types/date';
import type { CgDirection } from '../../types';
import type { CgPopupProps } from '../Popup';
import type { CgSchedulerResource, CgSchedulerAppointmentLabel, CgSchedulerAppointmentStatus, CgSchedulerGroupType } from './schedulerResources';
export type CgSchedulerTimeScaleUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
export interface CgSchedulerTimeScale { readonly unit: CgSchedulerTimeScaleUnit; readonly unitCount?: number }
export type { CgSchedulerResource, CgSchedulerAppointmentLabel, CgSchedulerAppointmentStatus, CgSchedulerGroupType } from './schedulerResources';
export type CgSchedulerSnapMode = 'auto' | 'always' | 'never';
export type CgSchedulerTimeIndicatorVisibility = 'never' | 'always' | 'todayView';
export type CgSchedulerOrientation = 'horizontal' | 'vertical';
export type CgSchedulerPopupOptions = Pick<CgPopupProps, 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight' | 'allowDrag' | 'allowResize' | 'className' | 'position' | 'defaultPosition' | 'onPositionChange'>;
export interface CgSchedulerPopupContext<TItem> { item: TItem | null; draft: Readonly<CgSchedulerAppointmentDraft>; isTooltip: boolean; scope?: CgSchedulerRecurrenceEditScope; signal?: AbortSignal }
export type CgSchedulerPopupBeforeHandler<TItem> = (context: CgSchedulerPopupContext<TItem>) => void | boolean | PromiseLike<void | boolean>;
export interface CgSchedulerCustomField { readonly key: string; readonly label: string; readonly type?: 'text' | 'number' | 'boolean'; readonly required?: boolean }
export interface CgSchedulerResourceHeaderContext { resource: CgSchedulerResource; view: CgSchedulerView; date?: CgDateValue }
export interface CgSchedulerCellDecoration { className?: string; style?: CSSProperties; attributes?: Readonly<Record<string, string | number | boolean | undefined>> }
export interface CgSchedulerCellContext { start: CgSchedulerInstant; end: CgSchedulerInstant; date: CgDateValue; isAllDay: boolean; isWorkingTime: boolean; resource?: CgSchedulerResource; view: CgSchedulerView; cellType: 'dateHeader' | 'dayOfWeekHeader' | 'resourceHeader' | 'timeCell' | 'allDayTimeCell' }

export type CgSchedulerView = 'day' | 'workWeek' | 'week' | 'month' | 'timeline';
export type CgSchedulerKey = string | number;
/** ISO 8601 instant with an explicit Z or numeric offset. Callbacks emit UTC. */
export type CgSchedulerInstant = string;
export interface CgSchedulerVisibleRange { startDate: CgDateValue; endDate: CgDateValue; start: CgSchedulerInstant; end: CgSchedulerInstant }
export type CgSchedulerRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CgSchedulerRecurrenceRange = 'noEndDate' | 'occurrenceCount' | 'endByDate';
export type CgSchedulerWeekOfMonth = 'none' | 'first' | 'second' | 'third' | 'fourth' | 'last';
export type CgSchedulerRecurrenceEditScope = 'series' | 'occurrence';
export interface CgSchedulerRecurrenceRule {
  readonly frequency: CgSchedulerRecurrenceFrequency;
  readonly interval?: number;
  readonly range?: CgSchedulerRecurrenceRange;
  readonly occurrenceCount?: number;
  readonly endDate?: CgDateValue;
  readonly weekDays?: readonly CgDayOfWeek[];
  readonly dayOfMonth?: number;
  readonly month?: number;
  readonly weekOfMonth?: CgSchedulerWeekOfMonth;
  readonly exceptions?: readonly CgSchedulerRecurrenceException[];
}
export interface CgSchedulerRecurrenceException {
  readonly originalStart: CgSchedulerInstant;
  readonly isDeleted?: boolean;
  readonly replacement?: Readonly<CgSchedulerAppointmentDraft>;
}
export interface CgSchedulerAppointmentDraft {
  title: string;
  start: CgSchedulerInstant;
  end: CgSchedulerInstant;
  description: string;
  color: string;
  isAllDay: boolean;
  recurrence?: CgSchedulerRecurrenceRule;
  location?: string;
  labelId?: CgSchedulerKey | null;
  statusId?: CgSchedulerKey | null;
  resourceIds?: readonly CgSchedulerKey[];
  customFields?: Readonly<Record<string, unknown>>;
}
export type CgSchedulerOperationResult = { success: true } | { success: false; error?: string; fieldErrors?: Partial<Record<keyof CgSchedulerAppointmentDraft, string>> };
export type CgSchedulerInteractionSource = 'editor' | 'timeCell' | 'keyboard' | 'drag' | 'resize';
export interface CgSchedulerOperationRequest<TItem> {
  dataVersion?: unknown;
  queryContext?: unknown;
  originalItem: TItem | null;
  original: Readonly<CgSchedulerAppointmentDraft> | null;
  draft: Readonly<CgSchedulerAppointmentDraft>;
  source: CgSchedulerInteractionSource;
  edge?: 'start' | 'end';
  scope?: CgSchedulerRecurrenceEditScope;
  originalOccurrenceStart?: CgSchedulerInstant;
  occurrenceAction?: 'replace' | 'delete' | 'restore';
}
export interface CgSchedulerReminder<TItem> { readonly item: TItem; readonly id: CgSchedulerKey; readonly key: string; readonly title: string; readonly appointmentStart: CgSchedulerInstant; readonly dueAt: CgSchedulerInstant; readonly isOccurrence: boolean; readonly originalOccurrenceStart?: CgSchedulerInstant }
export interface CgSchedulerICalendarOptions { calendarName?: string; download?: boolean; fileName?: string }
export interface CgSchedulerAppointmentTarget { id: CgSchedulerKey; originalOccurrenceStart?: CgSchedulerInstant }
export interface CgSchedulerActions<TItem> {
  goToDate: (date: CgDateValue) => void;
  navigate: (direction: -1 | 1) => void;
  today: () => void;
  changeView: (view: CgSchedulerView) => void;
  refresh: () => void;
  selectAppointment: (target: CgSchedulerAppointmentTarget | null) => boolean;
  scrollTo: (target: CgSchedulerAppointmentTarget | CgSchedulerInstant) => Promise<boolean>;
  createAppointment: (draft: CgSchedulerAppointmentDraft) => Promise<CgSchedulerOperationResult | undefined>;
  editAppointment: (target: CgSchedulerAppointmentTarget) => void;
  saveAppointment: (target: CgSchedulerAppointmentTarget, draft: CgSchedulerAppointmentDraft, scope?: CgSchedulerRecurrenceEditScope) => Promise<CgSchedulerOperationResult | undefined>;
  deleteAppointment: (target: CgSchedulerAppointmentTarget, scope?: CgSchedulerRecurrenceEditScope) => Promise<CgSchedulerOperationResult | undefined>;
  restoreOccurrence: (target: Required<CgSchedulerAppointmentTarget>) => Promise<CgSchedulerOperationResult | undefined>;
  showCreateAppointmentForm: (cell?: CgSchedulerTimeCellContext) => void;
  showEditAppointmentForm: (target: CgSchedulerAppointmentTarget) => void;
  saveForm: () => Promise<CgSchedulerOperationResult | undefined>;
  closeAppointmentForm: () => void;
  showAppointmentTooltip: (target: CgSchedulerAppointmentTarget) => void;
  closeAppointmentTooltip: () => void;
  getReminders: (windowStart: CgSchedulerInstant, windowEnd: CgSchedulerInstant) => readonly CgSchedulerReminder<TItem>[];
  exportToICalendar: (options?: CgSchedulerICalendarOptions) => string;
}
export type CgSchedulerOperationHandler<TItem> = (request: CgSchedulerOperationRequest<TItem>, signal: AbortSignal) => CgSchedulerOperationResult | Promise<CgSchedulerOperationResult>;
export interface CgSchedulerAppointmentContext<TItem> extends Readonly<CgSchedulerAppointmentDraft> {
  orientation?: CgSchedulerOrientation;
  resource?: CgSchedulerResource;
  item: TItem;
  id: CgSchedulerKey;
  isSelected: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
  view: CgSchedulerView;
  originalOccurrenceStart?: CgSchedulerInstant;
}
export interface CgSchedulerTimeCellContext {
  resource?: CgSchedulerResource;
  date: CgDateValue;
  start: CgSchedulerInstant;
  end: CgSchedulerInstant;
  label: string;
  isAllDay: boolean;
  isWorkingTime: boolean;
  isSelected: boolean;
  view: CgSchedulerView;
}
export interface CgSchedulerSelection<TItem> { appointment: TItem | null; appointmentId: CgSchedulerKey | null; slot: CgSchedulerTimeCellContext | null; originalOccurrenceStart?: CgSchedulerInstant }
export interface CgSchedulerProviderRequest { range: CgSchedulerVisibleRange; view: CgSchedulerView; signal: AbortSignal; visibleResourceIds?: readonly CgSchedulerKey[]; dataVersion?: unknown; queryContext?: unknown }
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
  actionsRef?: Ref<CgSchedulerActions<TItem>>;
  /** Reminder lead time in minutes. Negative/null values disable that appointment's reminder. */
  reminderSelector?: (item: TItem) => number | null | undefined;
  onRemindersDue?: (reminders: readonly CgSchedulerReminder<TItem>[]) => void | PromiseLike<void>;
  dataVersion?: unknown;
  queryContext?: unknown;
  idSelector: (item: TItem) => CgSchedulerKey;
  titleSelector: (item: TItem) => string | null | undefined;
  startSelector: (item: TItem) => CgSchedulerInstant;
  endSelector: (item: TItem) => CgSchedulerInstant;
  descriptionSelector?: (item: TItem) => string | null | undefined;
  colorSelector?: (item: TItem) => string | null | undefined;
  allDaySelector?: (item: TItem) => boolean;
  cssClassSelector?: (item: TItem) => string | null | undefined;
  locationSelector?: (item: TItem) => string | null | undefined;
  labelIdSelector?: (item: TItem) => CgSchedulerKey | null | undefined;
  statusIdSelector?: (item: TItem) => CgSchedulerKey | null | undefined;
  resourceIdsSelector?: (item: TItem) => readonly CgSchedulerKey[] | null | undefined;
  customFieldsSelector?: (item: TItem) => Readonly<Record<string, unknown>> | null | undefined;
  customFields?: readonly CgSchedulerCustomField[];
  resources?: readonly CgSchedulerResource[];
  visibleResourceIds?: readonly CgSchedulerKey[];
  defaultVisibleResourceIds?: readonly CgSchedulerKey[];
  onVisibleResourceIdsChange?: (ids: readonly CgSchedulerKey[]) => void;
  resourceNavigatorVisible?: boolean;
  resourceColorInHeaderVisible?: boolean;
  appointmentLabels?: readonly CgSchedulerAppointmentLabel[];
  statuses?: readonly CgSchedulerAppointmentStatus[];
  groupType?: CgSchedulerGroupType;
  resourceCellWidth?: number;
  resourceCaptionOrientation?: CgSchedulerOrientation;
  allowDragAppointmentBetweenResources?: boolean;
  recurrenceSelector?: (item: TItem) => CgSchedulerRecurrenceRule | null | undefined;
  enableRecurrence?: boolean;
  recurringAppointmentDragMode?: CgSchedulerRecurrenceEditScope;
  selectedOccurrenceStart?: CgSchedulerInstant | null;
  onSelectedOccurrenceStartChange?: (start: CgSchedulerInstant | null) => void;
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
  defaultDisplayTimeZone?: string;
  onDisplayTimeZoneChange?: (zone: string) => void;
  timeZoneOptions?: readonly string[];
  showTimeZoneSelector?: boolean;
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
  showWorkDaysOnly?: boolean;
  showAppointmentDateTimeRange?: boolean;
  validateEditForm?: boolean;
  snapToCellsMode?: CgSchedulerSnapMode;
  timeIndicatorVisibility?: CgSchedulerTimeIndicatorVisibility;
  dayCellMinWidth?: number;
  monthCellMinWidth?: number;
  monthCellMinHeight?: number;
  monthLastAppointmentIndent?: number;
  dayCount?: number;
  monthCount?: number;
  monthAppointmentLimit?: number;
  timelineDuration?: number;
  timelineScale?: number;
  timelineCellMinWidth?: number;
  timelineCellMinHeight?: number;
  timelineLastAppointmentIndent?: number;
  timelineScales?: readonly CgSchedulerTimeScale[];
  timelineStartTime?: string;
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
  renderHorizontalAppointment?: (context: CgSchedulerAppointmentContext<TItem>) => ReactNode;
  renderVerticalAppointment?: (context: CgSchedulerAppointmentContext<TItem>) => ReactNode;
  renderAllDayTimeCell?: (context: CgSchedulerTimeCellContext) => ReactNode;
  renderDayOfWeekHeader?: (context: CgSchedulerHeaderContext) => ReactNode;
  renderResourceHeader?: (context: CgSchedulerResourceHeaderContext) => ReactNode;
  renderEditorHeader?: (context: CgSchedulerEditorContext<TItem>) => ReactNode;
  renderAppointmentTooltip?: (context: CgSchedulerAppointmentContext<TItem>) => ReactNode;
  renderAppointmentTooltipHeader?: (context: CgSchedulerAppointmentContext<TItem>) => ReactNode;
  cellDecoration?: (context: CgSchedulerCellContext) => CgSchedulerCellDecoration | null | undefined;
  showAppointmentTooltip?: boolean;
  appointmentFormOptions?: CgSchedulerPopupOptions;
  appointmentTooltipOptions?: CgSchedulerPopupOptions;
  onAppointmentFormShowing?: CgSchedulerPopupBeforeHandler<TItem>;
  onAppointmentFormClosing?: CgSchedulerPopupBeforeHandler<TItem>;
  onAppointmentFormShown?: (context: CgSchedulerPopupContext<TItem>) => void | PromiseLike<void>;
  onAppointmentFormClosed?: (context: CgSchedulerPopupContext<TItem>) => void | PromiseLike<void>;
  onAppointmentTooltipShowing?: CgSchedulerPopupBeforeHandler<TItem>;
  onAppointmentTooltipClosing?: CgSchedulerPopupBeforeHandler<TItem>;
  onAppointmentTooltipShown?: (context: CgSchedulerPopupContext<TItem>) => void | PromiseLike<void>;
  onAppointmentTooltipClosed?: (context: CgSchedulerPopupContext<TItem>) => void | PromiseLike<void>;
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
