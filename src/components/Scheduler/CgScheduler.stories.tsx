import { useCallback, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgScheduler } from './CgScheduler';
import type { CgSchedulerAppointmentDraft, CgSchedulerItemsProvider, CgSchedulerOperationHandler, CgSchedulerView } from './CgScheduler.types';

interface DemoItem extends CgSchedulerAppointmentDraft { id: number }
const now = () => '2026-09-07T10:15:00Z';
const initial: DemoItem[] = [
  { id: 1, title: 'Project planning', start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:30:00Z', isAllDay: false, description: 'Priorities for the week', color: '#1769ff' },
  { id: 2, title: 'Design review', start: '2026-09-07T09:30:00Z', end: '2026-09-07T11:00:00Z', isAllDay: false, description: '', color: '#8b5cf6' },
  { id: 3, title: 'Team offsite', start: '2026-09-08T00:00:00Z', end: '2026-09-10T00:00:00Z', isAllDay: true, description: '', color: '#067647' },
  { id: 4, title: 'Customer call', start: '2026-09-09T13:00:00Z', end: '2026-09-09T14:00:00Z', isAllDay: false, description: '', color: '#98600a' },
  { id: 5, title: 'Release preparation', start: '2026-09-07T13:00:00Z', end: '2026-09-07T14:00:00Z', isAllDay: false, description: '', color: '' },
  { id: 6, title: 'Retrospective', start: '2026-09-07T15:00:00Z', end: '2026-09-07T16:00:00Z', isAllDay: false, description: '', color: '' },
];
const selectors = {
  idSelector: (a: DemoItem) => a.id, titleSelector: (a: DemoItem) => a.title,
  startSelector: (a: DemoItem) => a.start, endSelector: (a: DemoItem) => a.end,
  allDaySelector: (a: DemoItem) => a.isAllDay, descriptionSelector: (a: DemoItem) => a.description, colorSelector: (a: DemoItem) => a.color,
};
function Demo({ view = 'week', rtl = false, readOnly = false, remote = false, custom = false }: { view?: CgSchedulerView; rtl?: boolean; readOnly?: boolean; remote?: boolean; custom?: boolean }) {
  const [items, setItems] = useState(initial); const [lastAction, setLastAction] = useState('');
  const save: CgSchedulerOperationHandler<DemoItem> = (request) => {
    setItems((current) => request.originalItem ? current.map((a) => a.id === request.originalItem!.id ? { ...request.draft, id: a.id } : a) : [...current, { ...request.draft, id: Math.max(0, ...current.map((a) => a.id)) + 1 }]);
    setLastAction(`${request.source}: ${request.draft.title} ${request.draft.start} ${request.draft.end}`);
    return { success: true };
  };
  const load = useCallback<CgSchedulerItemsProvider<DemoItem>>(({ range, signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(items.filter((a) => a.start < range.end && a.end > range.start)), 250);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  }), [items]);
  return <div style={{ maxWidth: 1200, margin: 'auto', padding: 12 }}>
    <CgScheduler {...selectors} {...(remote ? { itemsProvider: load } : { items })} defaultSelectedDate="2026-09-07" defaultCurrentView={view} firstDayOfWeek="monday" now={now} visibleDayStart="08:00" visibleDayEnd="18:00" height={580} readOnly={readOnly} locale={rtl ? 'ar-EG' : 'en-US'} direction={rtl ? 'rtl' : 'ltr'}
      onAppointmentCreating={save} onAppointmentUpdating={save} onAppointmentDragging={save} onAppointmentResizing={save}
      onAppointmentDeleting={({ originalItem }) => { setItems((current) => current.filter((a) => a.id !== originalItem?.id)); setLastAction('deleted'); return { success: true }; }}
      renderAppointment={custom ? (a) => <strong>● {a.title}</strong> : undefined} />
    <output data-testid="last-action">{lastAction}</output>
  </div>;
}
const meta = { title: 'Data/Scheduler', component: Demo, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Week: Story = { render: () => <Demo /> };
export const Day: Story = { render: () => <Demo view="day" /> };
export const WorkWeek: Story = { render: () => <Demo view="workWeek" /> };
export const Month: Story = { render: () => <Demo view="month" /> };
export const Timeline: Story = { render: () => <Demo view="timeline" /> };
export const PartialTimeline: Story = { render: () => <CgScheduler {...selectors} items={[{ ...initial[0]!, title: 'Partial scale', start: '2026-09-07T01:30:00Z', end: '2026-09-07T02:30:00Z' }]} defaultSelectedDate="2026-09-07" defaultCurrentView="timeline" timelineDuration={150} timelineScale={60} now={now} height={360} /> };
export const RemoteLoading: Story = { render: () => <Demo remote /> };
export const ReadOnly: Story = { render: () => <Demo readOnly /> };
export const CustomRendering: Story = { render: () => <Demo custom /> };
export const ArabicRtl: Story = { render: () => <Demo rtl />, globals: { direction: 'rtl' } };
export const Dark: Story = { render: () => <Demo />, globals: { theme: 'dark' } };
