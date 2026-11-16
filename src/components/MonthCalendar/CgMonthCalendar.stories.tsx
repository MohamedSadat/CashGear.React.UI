import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { cgStartsDrag, cgTrackDrag } from '../DragDrop';
import { CgFlyout } from '../Flyout';
import { CgIcon } from '../Icon';
import { CgInlineTextEditor } from '../InlineEditor';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import { CgMonthCalendar } from './CgMonthCalendar';
import type { CgMonthCalendarHandle, CgMonthCalendarItem, CgMonthCalendarLabels, CgMonthCalendarProps } from './CgMonthCalendar.types';

const source = 'None: React only (Cash Gear Workspace Track U15, the database calendar view)';
const difference = 'Items with a start and an inclusive end from the caller and no editor of its own: open, create and move are callbacks.';
const meta = { title: 'Phase 37/MonthCalendar', component: CgMonthCalendar, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgMonthCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;

const arabicLabels: CgMonthCalendarLabels = {
  grid: 'تقويم المهام',
  previousMonth: 'الشهر السابق',
  nextMonth: 'الشهر التالي',
  today: 'اليوم',
  more: (count) => `+${count} أخرى`,
  moreLabel: (count, date) => `${count} عناصر أخرى في ${date}`,
  dayItems: (date) => `عناصر ${date}`,
  create: (date) => `عنصر جديد في ${date}`,
  moved: (item, date) => `نُقل «${item.title}» إلى ${date}`,
  item: (_item, info) => (info.end ? `${info.title}، من ${info.start} إلى ${info.end}` : info.time ? `${info.title}، ${info.time}` : info.title),
  moveHint: 'Alt مع الأسهم ينقله يوماً أو أسبوعاً',
  weekItems: (start, end) => `عناصر الأسبوع من ${start} إلى ${end}`,
  untitled: 'بلا عنوان',
};

const englishLabels: CgMonthCalendarLabels = {
  grid: 'Tasks calendar',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  more: (count) => `+${count} more`,
  moreLabel: (count, date) => `${count} more on ${date}`,
  dayItems: (date) => `Items on ${date}`,
  create: (date) => `New item on ${date}`,
  moved: (item, date) => `${item.title} moved to ${date}`,
  item: (_item, info) => (info.end ? `${info.title}, ${info.start} to ${info.end}` : info.time ? `${info.title}, ${info.time}` : info.title),
  moveHint: 'Alt and the arrow keys move it by a day or a week',
  weekItems: (start, end) => `Items from ${start} to ${end}`,
  untitled: 'Untitled',
};

// Colours are the caller's: theme tokens here, so the bars follow light and dark.
const arabicItems: CgMonthCalendarItem[] = [
  { key: 'carry', title: 'جرد نهاية الشهر', start: '2026-10-29', end: '2026-11-02', color: 'var(--cg-warning-text)' },
  { key: 'meeting', title: 'اجتماع الفريق', start: '2026-11-03T07:30:00Z', color: 'var(--cg-info-text)' },
  { key: 'budget', title: 'مراجعة الميزانية', start: '2026-11-04' },
  { key: 'quarter', title: 'إغلاق الربع', start: '2026-11-11', end: '2026-11-17', color: 'var(--cg-success-text)' },
  { key: 'payroll', title: 'صرف الرواتب', start: '2026-11-16', color: 'var(--cg-danger-text)' },
  { key: 'deadline', title: 'موعد تسليم الإقرار', start: '2026-11-19', end: '2026-11-19', movable: false, color: 'var(--cg-danger-text)' },
  { key: 'audit-1', title: 'تدقيق الفواتير', start: '2026-11-24' },
  { key: 'audit-2', title: 'مطابقة البنك', start: '2026-11-24', color: 'var(--cg-info-text)' },
  { key: 'audit-3', title: 'مراجعة المخزون', start: '2026-11-24', color: 'var(--cg-success-text)' },
  { key: 'audit-4', title: 'اعتماد المصروفات', start: '2026-11-24', color: 'var(--cg-warning-text)' },
  { key: 'audit-5', title: 'تقرير الإدارة', start: '2026-11-24T11:00:00Z' },
  { key: 'trip', title: 'زيارة الفرع', start: '2026-11-26', end: '2026-12-01', color: 'var(--cg-info-text)' },
];

const englishItems: CgMonthCalendarItem[] = [
  { key: 'standup', title: 'Team stand-up', start: '2026-11-02T14:30:00Z', color: 'var(--cg-info-text)' },
  { key: 'close', title: 'Quarter close', start: '2026-11-12', end: '2026-11-17', color: 'var(--cg-success-text)' },
  { key: 'payroll', title: 'Payroll', start: '2026-11-16', color: 'var(--cg-danger-text)' },
  { key: 'filing', title: 'Tax filing due', start: '2026-11-20', end: '2026-11-20', movable: false, color: 'var(--cg-danger-text)' },
  { key: 'review-1', title: 'Invoice review', start: '2026-11-24' },
  { key: 'review-2', title: 'Bank reconciliation', start: '2026-11-24', color: 'var(--cg-info-text)' },
  { key: 'review-3', title: 'Stock count', start: '2026-11-24', color: 'var(--cg-success-text)' },
  { key: 'review-4', title: 'Expense approval', start: '2026-11-24T16:00:00Z', color: 'var(--cg-warning-text)' },
  { key: 'holiday', title: 'Thanksgiving', start: '2026-11-26', end: '2026-11-27', movable: false, color: 'var(--cg-warning-text)' },
];

type AgendaProps = Pick<CgMonthCalendarProps, 'labels' | 'locale' | 'firstDayOfWeek' | 'timeZone'> & { initial: CgMonthCalendarItem[]; controlled?: boolean };

function Agenda({ initial, controlled = false, ...props }: AgendaProps) {
  const [items, setItems] = useState(initial);
  const [month, setMonth] = useState('2026-11');
  const [lastAction, setLastAction] = useState('');
  return <div style={{ display: 'grid', gap: 8, inlineSize: '100%' }}>
    <CgMonthCalendar
      {...props}
      data-testid="month-calendar"
      items={items}
      today="2026-11-16"
      month={controlled ? month : undefined}
      defaultMonth={controlled ? undefined : '2026-11'}
      onMonthChange={(next) => setMonth(next)}
      onItemOpen={(item, details) => setLastAction(`open:${item.key}:${details.source}`)}
      onCreate={(date, details) => setLastAction(`create:${date}:${details.source}`)}
      onItemMove={(item, details) => {
        setItems((current) => current.map((entry) => (entry.key === item.key ? { ...entry, start: details.start, end: details.end } : entry)));
        setLastAction(`move:${item.key}:${details.start}:${details.end ?? '-'}:${details.source}`);
      }}
    />
    <div style={{ display: 'flex', gap: 16, color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>
      <output data-testid="last-action" dir="ltr">{lastAction}</output>
      {controlled ? <output data-testid="month" dir="ltr">{month}</output> : null}
    </div>
  </div>;
}

const arabic = <Agenda initial={arabicItems} labels={arabicLabels} locale="ar" firstDayOfWeek="saturday" timeZone="Asia/Riyadh" />;
const args = { items: [], labels: englishLabels } as never;

// ---- A list of items with no date beside the calendar, as Cash Gear Workspace has ----------------
const undatedDifference = 'The list of items with no date is the caller\'s: it drags them with cgTrackDrag and finds the day with the handle\'s dayAt; a create from outside goes through startCreate.';
const arabicDate = new Intl.DateTimeFormat('ar', { calendar: 'gregory', timeZone: 'UTC', dateStyle: 'full' });
const longDate = (date: string) => arabicDate.format(new Date(`${date}T00:00:00Z`));

interface UndatedEntry { key: string; title: string }

const undatedEntries: UndatedEntry[] = [
  { key: 'supplier', title: 'تحديث بيانات المورد' },
  { key: 'quote', title: 'طلب عرض سعر' },
  { key: 'renewal', title: 'تجديد الاشتراك' },
  { key: 'archive', title: 'أرشفة العقود' },
];
const datedEntries = arabicItems.filter((item) => !item.key.startsWith('audit-'));

function UndatedPlanner() {
  const listId = useId();
  const calendar = useRef<CgMonthCalendarHandle>(null);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  const created = useRef(0);
  const [items, setItems] = useState(datedEntries);
  const [undated, setUndated] = useState(undatedEntries);
  const [selectedDay, setSelectedDay] = useState('2026-11-16');
  const [lastAction, setLastAction] = useState('');
  const [creating, setCreating] = useState<{ date: string; anchor: HTMLElement } | null>(null);

  useEffect(() => () => stopDrag.current?.(), []);

  const place = (entry: UndatedEntry, date: string, source: 'pointer' | 'button') => {
    setUndated((list) => list.filter((candidate) => candidate.key !== entry.key));
    setItems((list) => [...list, { key: entry.key, title: entry.title, start: date }]);
    setLastAction(`place:${entry.key}:${date}:${source}`);
    live.current?.announce(`وُضع «${entry.title}» في ${longDate(date)}`);
  };

  // The drag is the caller's: the calendar only says which day is under the pointer and marks it.
  const startDrag = (event: PointerEvent<HTMLLIElement>, entry: UndatedEntry) => {
    if (event.button !== 0 || !cgStartsDrag(event.target, event.currentTarget)) return;
    stopDrag.current?.();
    stopDrag.current = cgTrackDrag(event, event.currentTarget, {
      onMove: (x, y) => calendar.current?.markDropDay(calendar.current.dayAt(x, y)),
      onDrop: (x, y) => {
        stopDrag.current = null;
        calendar.current?.markDropDay(null);
        const date = calendar.current?.dayAt(x, y);
        if (date) place(entry, date, 'pointer');
      },
      onCancel: () => {
        stopDrag.current = null;
        calendar.current?.markDropDay(null);
      },
    });
  };

  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: 12, inlineSize: '100%' }}>
    <CgMonthCalendar
      actionsRef={calendar}
      data-testid="month-calendar"
      style={{ flex: '1 1 35rem' }}
      items={items}
      labels={arabicLabels}
      locale="ar"
      firstDayOfWeek="saturday"
      timeZone="Asia/Riyadh"
      today="2026-11-16"
      defaultMonth="2026-11"
      selectedDay={selectedDay}
      onSelectedDayChange={(date) => setSelectedDay(date)}
      onItemOpen={(item, details) => setLastAction(`open:${item.key}:${details.source}`)}
      onCreate={(date, details) => {
        setLastAction(`create:${date}:${details.source}`);
        setCreating({ date, anchor: details.anchor });
      }}
      onItemMove={(item, details) => {
        setItems((current) => current.map((entry) => (entry.key === item.key ? { ...entry, start: details.start, end: details.end } : entry)));
        setLastAction(`move:${item.key}:${details.start}:${details.end ?? '-'}:${details.source}`);
      }}
    />
    <div style={{ display: 'grid', flex: '1 1 12rem', gap: 8, minInlineSize: 0 }}>
      <CgButton appearance="solid" size="small" data-testid="new-on-selected-day" onClick={() => calendar.current?.startCreate(selectedDay)}>
        <CgIcon name="add" />عنصر جديد في اليوم المحدد
      </CgButton>
      <div id={listId} style={{ color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)', fontWeight: 'var(--cg-font-weight-medium)' }}>بلا تاريخ</div>
      <ul aria-labelledby={listId} data-testid="undated-list" style={{ display: 'grid', gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
        {undated.map((entry) => <li
          key={entry.key}
          data-testid={`undated-${entry.key}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, paddingBlock: 2, paddingInline: 8, border: 'var(--cg-border-width) solid var(--cg-border)',
            borderRadius: 'var(--cg-radius-sm)', background: 'var(--cg-surface)', color: 'var(--cg-text)', cursor: 'grab', touchAction: 'none', userSelect: 'none',
          }}
          onPointerDown={(event) => startDrag(event, entry)}
        >
          <CgIcon name="drag-handle" />
          <span dir="auto" style={{ flex: 1, minInlineSize: 0, fontSize: 'var(--cg-font-size-sm)' }}>{entry.title}</span>
          <CgButton appearance="ghost" size="small" aria-label={`ضع «${entry.title}» في اليوم المحدد`} title={`ضع «${entry.title}» في اليوم المحدد`} onClick={() => place(entry, selectedDay, 'button')}>
            <CgIcon name="calendar" />
          </CgButton>
        </li>)}
      </ul>
      {undated.length ? null : <div style={{ color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>لا عناصر بلا تاريخ</div>}
      <div style={{ display: 'grid', gap: 4, color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>
        <span>اليوم المحدد: <output data-testid="selected-day" dir="ltr">{selectedDay}</output></span>
        <span>آخر إجراء: <output data-testid="last-action" dir="ltr">{lastAction}</output></span>
      </div>
    </div>
    <CgLiveAnnouncer ref={live} />
    {creating ? <CgFlyout
      anchor={creating.anchor}
      open
      onOpenChange={(open) => { if (!open) setCreating(null); }}
      autoFocus
      returnFocusOnClose
      placement="bottom-start"
      minWidth="14rem"
      role="dialog"
      aria-label={`عنصر جديد في ${longDate(creating.date)}`}
      data-testid="create-flyout"
    >
      <div style={{ padding: 'var(--cg-space-3)' }}>
        <CgInlineTextEditor
          label="عنوان العنصر"
          defaultValue=""
          onCommit={(text) => {
            if (!text.trim()) return;
            created.current += 1;
            const key = `new-${created.current}`;
            setItems((list) => [...list, { key, title: text, start: creating.date }]);
            setLastAction(`created:${key}:${creating.date}`);
          }}
          onDone={({ end }) => {
            setCreating(null);
            // Enter or Escape gives the keys back to the day; a click elsewhere keeps its own focus.
            if (end !== 'blur') calendar.current?.getDayElement(creating.date)?.focus();
          }}
        />
      </div>
    </CgFlyout> : null}
  </div>;
}

export const ArabicMonth: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabic}</StoryFrame>, globals: { direction: 'rtl' } };
export const ArabicMonthDark: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabic}</StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const SundayFirstEnglish: Story = {
  args,
  render: () => <StoryFrame source={source} difference={difference}><Agenda initial={englishItems} labels={englishLabels} locale="en-US" firstDayOfWeek="sunday" timeZone="America/New_York" controlled /></StoryFrame>,
};
/** Items with no date dragged onto a day, or placed on the selected one; a create started from outside the grid. */
export const ArabicUndatedDrop: Story = { args, render: () => <StoryFrame source={source} difference={undatedDifference}><UndatedPlanner /></StoryFrame>, globals: { direction: 'rtl' } };
