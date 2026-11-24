import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgRecurrenceFields } from './CgRecurrenceFields';
import type { CgRecurrenceFieldsLabels, CgRecurrenceFieldsProps, CgRecurrenceRule, CgRecurrenceSummaryWords } from './CgRecurrenceFields.types';
import { cgNextOccurrence, cgOccurrencesBetween, cgSummarizeRecurrence, cgValidateRecurrence } from './recurrence';

const source = 'None: React only (Cash Gear Workspace Track U21, a database template\'s recurrence), CgScheduler\'s own recurrence fields and arithmetic';
const difference = 'The scheduler\'s fields as a controlled component of their own, every word the caller\'s, with the end fields optional; validation, the next occurrence, the occurrences in a range and a summary as functions.';
const meta = { title: 'Phase 37/RecurrenceFields', component: CgRecurrenceFields, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgRecurrenceFields>;
export default meta;
type Story = StoryObj<typeof meta>;

const arabicUnits = { daily: ['يوم', 'يومين', 'أيام'], weekly: ['أسبوع', 'أسبوعين', 'أسابيع'], monthly: ['شهر', 'شهرين', 'أشهر'], yearly: ['سنة', 'سنتين', 'سنوات'] } as const;

const arabicLabels: CgRecurrenceFieldsLabels = {
  legend: 'تكرار القالب',
  frequency: 'يتكرر',
  frequencies: { none: 'لا يتكرر', daily: 'يومياً', weekly: 'أسبوعياً', monthly: 'شهرياً', yearly: 'سنوياً' },
  interval: 'كل',
  intervalUnit: (frequency, interval) => (interval === 1 ? arabicUnits[frequency][0] : interval === 2 ? arabicUnits[frequency][1] : arabicUnits[frequency][2]),
  weekDays: 'في أيام',
  weekOfMonth: 'في',
  weeksOfMonth: { none: 'يوم محدد من الشهر', first: 'الأسبوع الأول', second: 'الأسبوع الثاني', third: 'الأسبوع الثالث', fourth: 'الأسبوع الرابع', last: 'الأسبوع الأخير' },
  dayOfMonth: 'اليوم من الشهر',
  month: 'الشهر',
  range: 'ينتهي',
  ranges: { noEndDate: 'لا ينتهي', occurrenceCount: 'بعد عدد من المرات', endByDate: 'في تاريخ' },
  occurrenceCount: 'عدد المرات',
  endDate: 'آخر يوم',
};

const arabicWords: CgRecurrenceSummaryWords = {
  none: 'لا يتكرر',
  every: (frequency, interval) => (interval === 1 ? `كل ${arabicUnits[frequency][0]}` : interval === 2 ? `كل ${arabicUnits[frequency][1]}` : `كل ${interval} ${arabicUnits[frequency][2]}`),
  onWeekDays: (days) => `يوم ${days}`,
  onDayOfMonth: (day) => `في اليوم ${day}`,
  onDate: (month, day) => `في ${day} ${month}`,
  onWeekOfMonth: (week, days) => `في ${days} ${{ first: 'الأول', second: 'الثاني', third: 'الثالث', fourth: 'الرابع', last: 'الأخير' }[week]}`,
  ofMonth: (month) => `من ${month}`,
  times: (count) => `${count} مرات`,
  until: (date) => `حتى ${date}`,
  sentence: ({ every, on, month, end }) => [every, on, month].filter(Boolean).join(' ') + (end ? `، ${end}` : ''),
};

const englishUnits = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;

const englishLabels: CgRecurrenceFieldsLabels = {
  legend: 'Repeat',
  frequency: 'Repeats',
  frequencies: { none: 'Does not repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' },
  interval: 'Every',
  intervalUnit: (frequency, interval) => `${englishUnits[frequency]}${interval === 1 ? '' : 's'}`,
  weekDays: 'On',
  weekOfMonth: 'On',
  weeksOfMonth: { none: 'A day of the month', first: 'The first week', second: 'The second week', third: 'The third week', fourth: 'The fourth week', last: 'The last week' },
  dayOfMonth: 'Day',
  month: 'In',
  range: 'Ends',
  ranges: { noEndDate: 'Never', occurrenceCount: 'After a number of times', endByDate: 'On a date' },
  occurrenceCount: 'Times',
  endDate: 'Last day',
};

const englishWords: CgRecurrenceSummaryWords = {
  none: 'Does not repeat',
  every: (frequency, interval) => (interval === 1 ? `Every ${englishUnits[frequency]}` : `Every ${interval} ${englishUnits[frequency]}s`),
  onWeekDays: (days) => `on ${days}`,
  onDayOfMonth: (day) => `on day ${day}`,
  onDate: (month, day) => `on ${month} ${day}`,
  onWeekOfMonth: (week, days) => `on the ${week} ${days}`,
  ofMonth: (month) => `of ${month}`,
  times: (count) => `${count} times`,
  until: (date) => `until ${date}`,
};

const problemsArabic = { rule: 'قاعدة غير معروفة', interval: 'الفاصل عدد صحيح أكبر من صفر', occurrenceCount: 'العدد عدد صحيح أكبر من صفر', endDate: 'اختر آخر يوم', dayOfMonth: 'اليوم من 1 إلى 31', month: 'الشهر من 1 إلى 12', weekDays: 'يوم غير معروف', unreachable: 'لا يقع هذا التكرار على أي يوم' } as const;
const problemsEnglish = { rule: 'Unknown rule', interval: 'Every takes a whole number above 0', occurrenceCount: 'Times takes a whole number above 0', endDate: 'Choose the last day', dayOfMonth: 'Day takes 1 to 31', month: 'In takes 1 to 12', weekDays: 'Unknown weekday', unreachable: 'This rule never falls on a day' } as const;

type EditorProps = Omit<CgRecurrenceFieldsProps, 'value' | 'onChange'> & {
  initial: CgRecurrenceRule;
  start: string;
  timeZone: string;
  words: CgRecurrenceSummaryWords;
  problems: Readonly<Record<string, string>>;
  captions: { summary: string; next: string; upcoming: string };
};

/** The caller's side: the rule in its state, and under it the summary, the next occurrence and the next five, from the exported functions. */
function Editor({ initial, start, timeZone, words, problems, captions, ...props }: EditorProps) {
  const [rule, setRule] = useState(initial);
  const problem = cgValidateRecurrence(rule, start, timeZone);
  const series = { rule, start, timeZone };
  const dates = new Intl.DateTimeFormat(props.locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const day = (value: string) => dates.format(new Date(`${value}T00:00:00Z`));
  return <div style={{ display: 'grid', gap: 12, inlineSize: 'min(100%, 28rem)' }}>
    <CgRecurrenceFields {...props} value={rule} onChange={setRule} start={start} />
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: 0, fontSize: 'var(--cg-font-size-sm)' }}>
      <dt style={{ color: 'var(--cg-text-secondary)' }}>{captions.summary}</dt>
      <dd style={{ margin: 0 }} data-testid="summary">{problem ? <span role="alert" style={{ color: 'var(--cg-danger-text)' }}>{problems[problem]}</span> : cgSummarizeRecurrence(rule, words, { locale: props.locale, start, timeZone })}</dd>
      <dt style={{ color: 'var(--cg-text-secondary)' }}>{captions.next}</dt>
      <dd style={{ margin: 0 }} data-testid="next" data-value={problem ? '' : cgNextOccurrence(series, '2026-11-25') ?? ''}>{problem ? '—' : (() => { const next = cgNextOccurrence(series, '2026-11-25'); return next ? day(next) : '—'; })()}</dd>
      <dt style={{ color: 'var(--cg-text-secondary)' }}>{captions.upcoming}</dt>
      <dd style={{ margin: 0 }} data-testid="upcoming">{problem ? '—' : cgOccurrencesBetween(series, '2026-11-25', '2036-01-01', 5).map(day).join(' · ') || '—'}</dd>
    </dl>
  </div>;
}

const args = { value: { frequency: 'none' }, onChange: () => undefined, labels: englishLabels } as never;

const arabicTemplate = <Editor
  initial={{ frequency: 'weekly', interval: 2, weekDays: ['monday', 'wednesday'] }}
  start="2026-11-30"
  timeZone="Africa/Cairo"
  labels={arabicLabels}
  locale="ar"
  frequencies={['daily', 'weekly', 'monthly', 'yearly']}
  showEnd={false}
  words={arabicWords}
  problems={problemsArabic}
  captions={{ summary: 'الملخص', next: 'التالي بعد 25 نوفمبر', upcoming: 'القادمة' }}
/>;

/** A database template's rule: no end fields, weeks from Saturday, the summary and the next dates under it. */
export const ArabicTemplate: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabicTemplate}</StoryFrame>, globals: { direction: 'rtl' } };
export const ArabicTemplateDark: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabicTemplate}</StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
/** Left to right, weeks from Sunday, "does not repeat" offered and the end fields shown; monthly on the last Friday. */
export const EnglishWithEnd: Story = {
  args,
  render: () => <StoryFrame source={source} difference={difference}>
    <Editor
      initial={{ frequency: 'monthly', weekOfMonth: 'last', weekDays: ['friday'], range: 'occurrenceCount', occurrenceCount: 6 }}
      start="2026-11-27"
      timeZone="America/New_York"
      labels={englishLabels}
      locale="en-US"
      words={englishWords}
      problems={problemsEnglish}
      captions={{ summary: 'Summary', next: 'Next after Nov 25', upcoming: 'Upcoming' }}
    />
  </StoryFrame>,
};
/** Disabled while the caller saves. */
export const ArabicDisabled: Story = {
  args,
  render: () => <StoryFrame source={source} difference={difference}>
    <CgRecurrenceFields value={{ frequency: 'monthly', dayOfMonth: 31 }} onChange={() => undefined} labels={arabicLabels} locale="ar" disabled />
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
