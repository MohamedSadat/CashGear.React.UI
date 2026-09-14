import { useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton, CgScheduler } from '../index';
import type { CgSchedulerActions, CgSchedulerAppointmentDraft, CgSchedulerOperationRequest } from '../index';
import { changeOccurrence } from '../components/Scheduler/schedulerRecurrence';
interface Item extends CgSchedulerAppointmentDraft { id: number }
const originalStart = '2026-09-07T09:00:00.000Z';
const reminder = () => 30;
function Demo({ direction }: { direction?: 'ltr' | 'rtl' }) {
  const actions = useRef<CgSchedulerActions<Item>>(null);
  const [items, setItems] = useState<readonly Item[]>([{ id: 1, title: 'Daily planning', start: originalStart, end: '2026-09-07T10:00:00Z', description: 'Team planning', color: '', isAllDay: false, recurrence: { frequency: 'daily', range: 'occurrenceCount', occurrenceCount: 3 } }]);
  const [time, setTime] = useState('2026-09-07T08:29:00Z'); const clock = useMemo(() => () => time, [time]);
  const [reminders, setReminders] = useState(0); const [calendar, setCalendar] = useState('');
  const save = (request: CgSchedulerOperationRequest<Item>) => { setItems(current => current.map(item => item.id !== request.originalItem?.id ? item : request.occurrenceAction === 'restore' ? { ...item, ...request.draft } : request.scope === 'occurrence' && request.originalOccurrenceStart && item.recurrence ? { ...item, recurrence: changeOccurrence(item.recurrence, request.originalOccurrenceStart, request.occurrenceAction === 'delete' ? 'delete' : request.draft) } : { ...item, ...request.draft })); return { success: true as const }; };
  const target = { id: 1, originalOccurrenceStart: originalStart };
  return <main style={{ maxWidth: 1000, display: 'grid', gap: 12 }}><h1>Scheduler actions and reminders</h1>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <CgButton onClick={() => setTime('2026-09-07T08:30:00Z')}>Advance reminder clock</CgButton>
      <CgButton onClick={() => actions.current?.editAppointment(target)}>Edit occurrence</CgButton>
      <CgButton onClick={async () => { await actions.current?.deleteAppointment(target); }}>Delete occurrence</CgButton>
      <CgButton onClick={async () => { await actions.current?.restoreOccurrence(target); }}>Restore occurrence</CgButton>
      <CgButton onClick={() => setCalendar(actions.current?.exportToICalendar({ calendarName: 'Team' }) ?? '')}>Preview iCalendar</CgButton>
      <CgButton onClick={() => { actions.current?.exportToICalendar({ download: true, fileName: 'team.ics' }); }}>Download calendar</CgButton>
    </div><output aria-label="Reminders delivered">{reminders}</output>
    <CgScheduler items={items} idSelector={item => item.id} titleSelector={item => item.title} startSelector={item => item.start} endSelector={item => item.end} recurrenceSelector={item => item.recurrence} enableRecurrence reminderSelector={reminder} onRemindersDue={due => setReminders(count => count + due.length)} actionsRef={actions} onAppointmentUpdating={save} onAppointmentDeleting={save} defaultSelectedDate="2026-09-07" defaultCurrentView="day" visibleDayStart="08:00" visibleDayEnd="12:00" now={clock} direction={direction} height={360} />
    <label>Calendar text<textarea aria-label="Calendar text" readOnly value={calendar} placeholder="Preview the calendar export" style={{ display: 'block', width: '100%', height: 120, boxSizing: 'border-box', color: 'var(--cg-text)', background: 'var(--cg-surface)', border: '1px solid var(--cg-border)' }} /></label>
  </main>;
}
export default { title: 'Phase 32C/Actions', component: Demo } satisfies Meta<typeof Demo>;
export const Review: StoryObj<typeof Demo> = {};
export const RtlReview: StoryObj<typeof Demo> = { args: { direction: 'rtl' }, globals: { direction: 'rtl' } };
