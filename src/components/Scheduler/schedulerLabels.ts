import type { CgRecurrenceFieldsLabels } from '../RecurrenceFields/CgRecurrenceFields.types';
import type { CgSchedulerLabels } from './CgScheduler.types';
export const english: CgSchedulerLabels = {
  scheduler: 'Scheduler', previous: 'Previous', next: 'Next', today: 'Today', view: 'View',
  day: 'Day', workWeek: 'Work week', week: 'Week', month: 'Month', timeline: 'Timeline',
  allDay: 'All day', more: (count) => `+${count} more`, create: 'Create appointment', edit: 'Edit appointment',
  delete: 'Delete', deleteConfirmation: 'Delete this appointment?', title: 'Title', start: 'Start', end: 'End',
  description: 'Description', color: 'Color', save: 'Save', cancel: 'Cancel', loading: 'Loading…', retry: 'Retry',
  loadError: 'Appointments could not be loaded.', operationError: 'The appointment could not be saved.', invalidDates: 'End must be after start.', requiredTitle: 'Title is required.',
  timeZone: 'Time zone', resizeStart: 'Resize start', resizeEnd: 'Resize end', noAppointments: 'No appointments',
};
export const arabic: CgSchedulerLabels = {
  scheduler: 'الجدول', previous: 'السابق', next: 'التالي', today: 'اليوم', view: 'العرض',
  day: 'يوم', workWeek: 'أسبوع العمل', week: 'أسبوع', month: 'شهر', timeline: 'الخط الزمني',
  allDay: 'طوال اليوم', more: (count) => `+${count} المزيد`, create: 'إنشاء موعد', edit: 'تعديل الموعد',
  delete: 'حذف', deleteConfirmation: 'هل تريد حذف هذا الموعد؟', title: 'العنوان', start: 'البداية', end: 'النهاية',
  description: 'الوصف', color: 'اللون', save: 'حفظ', cancel: 'إلغاء', loading: 'جار التحميل…', retry: 'إعادة المحاولة',
  loadError: 'تعذر تحميل المواعيد.', operationError: 'تعذر حفظ الموعد.', invalidDates: 'يجب أن تكون النهاية بعد البداية.', requiredTitle: 'العنوان مطلوب.',
  timeZone: 'المنطقة الزمنية', resizeStart: 'تغيير البداية', resizeEnd: 'تغيير النهاية', noAppointments: 'لا توجد مواعيد',
};
/** The recurrence fields' words, as the editor has always written them. */
export const recurrenceEnglish: CgRecurrenceFieldsLabels = {
  legend: 'Recurrence', frequency: 'Frequency', frequencies: { none: 'none', daily: 'daily', weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' },
  interval: 'Interval', weekDays: 'Weekdays', weekOfMonth: 'Week of month', weeksOfMonth: { none: 'none', first: 'first', second: 'second', third: 'third', fourth: 'fourth', last: 'last' },
  dayOfMonth: 'Day of month', month: 'Month', range: 'Recurrence ends', ranges: { noEndDate: 'Never', occurrenceCount: 'After count', endByDate: 'On date' },
  occurrenceCount: 'Occurrence count', endDate: 'Recurrence end date',
};
export const recurrenceArabic: CgRecurrenceFieldsLabels = {
  legend: 'التكرار', frequency: 'النمط', frequencies: { none: 'بدون', daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي' },
  interval: 'الفاصل', weekDays: 'أيام الأسبوع', weekOfMonth: 'أسبوع الشهر', weeksOfMonth: { none: 'يوم محدد', first: 'الأول', second: 'الثاني', third: 'الثالث', fourth: 'الرابع', last: 'الأخير' },
  dayOfMonth: 'يوم الشهر', month: 'الشهر', range: 'نهاية التكرار', ranges: { noEndDate: 'بدون نهاية', occurrenceCount: 'بعد عدد', endByDate: 'في تاريخ' },
  occurrenceCount: 'العدد', endDate: 'تاريخ النهاية',
};
