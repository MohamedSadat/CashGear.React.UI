import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgScheduler } from '../index';
import type { CgSchedulerAppointmentDraft, CgSchedulerOperationRequest } from '../index';
import { changeOccurrence } from '../components/Scheduler/schedulerRecurrence';
interface Item extends CgSchedulerAppointmentDraft { id: number }
const initial: Item = { id: 1, title: 'Daily planning', start: '2026-03-07T14:00:00Z', end: '2026-03-07T15:00:00Z', description: '9 AM New York across the DST transition', color: '', isAllDay: false, recurrence: { frequency: 'daily', range: 'occurrenceCount', occurrenceCount: 7 } };
function Demo({ direction }: { direction?: 'ltr' | 'rtl' }) {
  const [items, setItems] = useState<readonly Item[]>([initial]); const [message, setMessage] = useState('Select an occurrence to edit');
  const save = (request: CgSchedulerOperationRequest<Item>) => {
    setMessage(`${request.scope}: ${request.originalOccurrenceStart ?? request.draft.start}`);
    setItems(current => current.map(item => item.id !== request.originalItem?.id ? item : request.scope === 'occurrence' && request.originalOccurrenceStart && item.recurrence ? { ...item, recurrence: changeOccurrence(item.recurrence, request.originalOccurrenceStart, request.draft) } : { ...item, ...request.draft }));
    return { success: true as const };
  };
  return <main style={{ maxWidth: 1100 }}><h1>Recurring appointments</h1><p>Daily planning stays at 9 AM in New York across daylight saving time.</p><output aria-label="Last operation">{message}</output>
    <CgScheduler items={items} idSelector={item => item.id} titleSelector={item => item.title} startSelector={item => item.start} endSelector={item => item.end} recurrenceSelector={item => item.recurrence} enableRecurrence displayTimeZone="America/New_York" defaultSelectedDate="2026-03-08" defaultCurrentView="day" visibleDayStart="08:00" visibleDayEnd="12:00" dayCount={3} direction={direction} now={() => '2026-03-08T12:00:00Z'} height={480} onAppointmentUpdating={save} onAppointmentDragging={save} onAppointmentResizing={save} />
  </main>;
}
export default { title: 'Phase 32A/Recurrence', component: Demo } satisfies Meta<typeof Demo>;
export const Review: StoryObj<typeof Demo> = {};
export const RtlReview: StoryObj<typeof Demo> = { args: { direction: 'rtl' }, globals: { direction: 'rtl' } };
