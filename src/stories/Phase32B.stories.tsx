import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgScheduler } from '../index';
import type { CgSchedulerAppointmentDraft, CgSchedulerOperationRequest } from '../index';
interface Item extends CgSchedulerAppointmentDraft { id: number }
const rooms = [{ id: 'a', caption: 'Room A', color: '#4169e1' }, { id: 'b', caption: 'Room B', color: '#16856c' }];
const clock = () => '2026-09-07T08:30:00Z';
function Demo({ direction }: { direction?: 'ltr' | 'rtl' }) {
  const [items, setItems] = useState<readonly Item[]>([{ id: 1, title: 'Project planning', start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:00:00Z', description: 'Review milestones', color: '', isAllDay: false, resourceIds: ['a'], location: 'Main office', customFields: { reference: 'CG-10' } }]);
  const [message, setMessage] = useState('Move or edit the appointment');
  const save = (request: CgSchedulerOperationRequest<Item>) => { setItems(current => current.map(item => item.id === request.originalItem?.id ? { ...item, ...request.draft } : item)); setMessage(`Resources: ${request.draft.resourceIds?.join(', ')}`); return { success: true as const }; };
  return <main><h1>Resource schedule</h1><output aria-label="Last operation">{message}</output><CgScheduler items={items} idSelector={item => item.id} titleSelector={item => item.title} startSelector={item => item.start} endSelector={item => item.end} descriptionSelector={item => item.description} locationSelector={item => item.location} resourceIdsSelector={item => item.resourceIds} customFieldsSelector={item => item.customFields} resources={rooms} groupType="resource" resourceColorInHeaderVisible showAppointmentTooltip customFields={[{ key: 'reference', label: 'Reference', required: true }]} appointmentLabels={[{ id: 'review', caption: 'Review' }]} statuses={[{ id: 'confirmed', caption: 'Confirmed' }]} defaultSelectedDate="2026-09-07" defaultCurrentView="day" visibleDayStart="08:00" visibleDayEnd="12:00" timelineStartTime="08:00" timelineDuration={240} timelineScales={[{ unit: 'day' }, { unit: 'hour' }]} height={520} now={clock} direction={direction} onAppointmentUpdating={save} onAppointmentDragging={save} onAppointmentResizing={save} appointmentFormOptions={{ allowDrag: true, allowResize: true }} /></main>;
}
export default { title: 'Phase 32B/Resources', component: Demo } satisfies Meta<typeof Demo>;
export const Review: StoryObj<typeof Demo> = {};
export const RtlReview: StoryObj<typeof Demo> = { args: { direction: 'rtl' }, globals: { direction: 'rtl' } };
