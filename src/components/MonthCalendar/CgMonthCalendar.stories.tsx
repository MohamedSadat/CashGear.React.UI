import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgMonthCalendar } from './CgMonthCalendar';
import type { CgMonthCalendarItem, CgMonthCalendarLabels, CgMonthCalendarProps } from './CgMonthCalendar.types';

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

export const ArabicMonth: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabic}</StoryFrame>, globals: { direction: 'rtl' } };
export const ArabicMonthDark: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabic}</StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const SundayFirstEnglish: Story = {
  args,
  render: () => <StoryFrame source={source} difference={difference}><Agenda initial={englishItems} labels={englishLabels} locale="en-US" firstDayOfWeek="sunday" timeZone="America/New_York" controlled /></StoryFrame>,
};
