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
