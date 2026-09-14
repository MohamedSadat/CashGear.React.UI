import type { CgSchedulerAppointmentDraft, CgSchedulerRecurrenceFrequency, CgSchedulerRecurrenceRange, CgSchedulerWeekOfMonth } from './CgScheduler.types';
import { WEEKDAYS } from './schedulerDate';
export function SchedulerRecurrenceFields({ draft, update, disabled, locale }: { draft: CgSchedulerAppointmentDraft; update: (draft: CgSchedulerAppointmentDraft) => void; disabled: boolean; locale: string }) {
  const ar = locale.startsWith('ar'); const rule = draft.recurrence;
  const patch = (value: Partial<NonNullable<typeof rule>>) => update({ ...draft, recurrence: { frequency: 'daily', ...rule, ...value } });
  return <fieldset disabled={disabled}>
    <legend>{ar ? 'التكرار' : 'Recurrence'}</legend>
    <label>{ar ? 'النمط' : 'Frequency'}<select value={rule?.frequency ?? 'none'} onChange={event => { const frequency = event.target.value as CgSchedulerRecurrenceFrequency; if (frequency === 'none') update({ ...draft, recurrence: undefined }); else patch({ frequency }); }}>{(['none', 'daily', 'weekly', 'monthly', 'yearly'] as const).map((frequency, i) => <option key={frequency} value={frequency}>{ar ? ['بدون', 'يومي', 'أسبوعي', 'شهري', 'سنوي'][i] : frequency}</option>)}</select></label>
    {rule && rule.frequency !== 'none' && <>
      <label>{ar ? 'الفاصل' : 'Interval'}<input type="number" min={1} value={rule.interval ?? 1} onChange={event => patch({ interval: Number(event.target.value) })} /></label>
      <label>{ar ? 'نهاية التكرار' : 'Recurrence ends'}<select value={rule.range ?? 'noEndDate'} onChange={event => patch({ range: event.target.value as CgSchedulerRecurrenceRange })}><option value="noEndDate">{ar ? 'بدون نهاية' : 'Never'}</option><option value="occurrenceCount">{ar ? 'بعد عدد' : 'After count'}</option><option value="endByDate">{ar ? 'في تاريخ' : 'On date'}</option></select></label>
      {rule.range === 'occurrenceCount' && <label>{ar ? 'العدد' : 'Occurrence count'}<input type="number" min={1} value={rule.occurrenceCount ?? 10} onChange={event => patch({ occurrenceCount: Number(event.target.value) })} /></label>}
      {rule.range === 'endByDate' && <label>{ar ? 'تاريخ النهاية' : 'Recurrence end date'}<input type="date" value={rule.endDate ?? ''} onChange={event => patch({ endDate: event.target.value })} /></label>}
      <fieldset><legend>{ar ? 'أيام الأسبوع' : 'Weekdays'}</legend>{WEEKDAYS.map((day, index) => <label key={day}><input type="checkbox" checked={rule.weekDays?.includes(day) ?? false} onChange={event => patch({ weekDays: event.target.checked ? [...(rule.weekDays ?? []), day] : rule.weekDays?.filter(value => value !== day) })} />{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 8, 6 + index))}</label>)}</fieldset>
      {(rule.frequency === 'monthly' || rule.frequency === 'yearly') && <>
        <label>{ar ? 'أسبوع الشهر' : 'Week of month'}<select value={rule.weekOfMonth ?? 'none'} onChange={event => patch({ weekOfMonth: event.target.value as CgSchedulerWeekOfMonth })}>{(['none', 'first', 'second', 'third', 'fourth', 'last'] as const).map((week, i) => <option key={week} value={week}>{ar ? ['يوم محدد', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الأخير'][i] : week}</option>)}</select></label>
        {(!rule.weekOfMonth || rule.weekOfMonth === 'none') && <label>{ar ? 'يوم الشهر' : 'Day of month'}<input type="number" min={1} max={31} value={rule.dayOfMonth ?? Number(draft.start.slice(8, 10))} onChange={event => patch({ dayOfMonth: Number(event.target.value) })} /></label>}
        {rule.frequency === 'yearly' && <label>{ar ? 'الشهر' : 'Month'}<select value={rule.month ?? Number(draft.start.slice(5, 7))} onChange={event => patch({ month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month + 1}>{new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2026, month, 1))}</option>)}</select></label>}
      </>}
    </>}
  </fieldset>;
}
