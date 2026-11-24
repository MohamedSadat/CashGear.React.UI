import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { cgStartsDrag, cgTrackDrag } from '../DragDrop';
import { CgIcon } from '../Icon';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import { CgTimeline } from './CgTimeline';
import type { CgTimelineHandle, CgTimelineItem, CgTimelineLabels, CgTimelineLane, CgTimelineLink, CgTimelineMoveDetails, CgTimelineProps, CgTimelineScale } from './CgTimeline.types';

const source = 'None: React only (Cash Gear Workspace Track U18, the database timeline view)';
const difference = 'Items with a start and an inclusive end from the caller, one line each in its order, and no editor of its own: open, create and move are callbacks.';
const meta = { title: 'Phase 37/Timeline', component: CgTimeline, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

const arabicLabels: CgTimelineLabels = {
  grid: 'الجدول الزمني للمشروع',
  previous: 'أيام سابقة',
  next: 'أيام لاحقة',
  today: 'اليوم',
  scales: { day: 'يوم', week: 'أسبوع', month: 'شهر', quarter: 'ربع' },
  scale: 'المقياس',
  item: (_item, info) => (info.end ? `${info.title}، من ${info.start} إلى ${info.end}` : `${info.title}، ${info.start}`),
  moveHint: 'Alt مع السهمين ينقله يوماً، ومع Shift يغيّر نهايته، وCtrl مع Shift يغيّر بدايته',
  moved: (item, info) => `نُقل «${item.title}» ليبدأ ${info.start}`,
  resized: (item, info) => (info.end ? `«${item.title}» الآن من ${info.start} إلى ${info.end}` : `«${item.title}» الآن يوم ${info.start}`),
  noLane: 'بلا مرحلة',
  untitled: 'بلا عنوان',
};

const englishLabels: CgTimelineLabels = {
  grid: 'Project timeline',
  previous: 'Earlier days',
  next: 'Later days',
  today: 'Today',
  scales: { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter' },
  scale: 'Scale',
  item: (_item, info) => (info.end ? `${info.title}, ${info.start} to ${info.end}` : `${info.title}, ${info.start}`),
  moveHint: 'Alt and the arrow keys move it a day; add Shift to change its end, or use Ctrl and Shift to change its start',
  moved: (item, info) => `${item.title} now starts ${info.start}`,
  resized: (item, info) => (info.end ? `${item.title} now runs ${info.start} to ${info.end}` : `${item.title} is now on ${info.start}`),
  noLane: 'No stage',
  untitled: 'Untitled',
  quarter: (quarter, year) => `Q${quarter} ${year}`,
};

/** With moveBetweenLanes: the hint names the lane keys, and a lane move has words of its own. */
const arabicLaneLabels: CgTimelineLabels = {
  ...arabicLabels,
  moveHint: 'Alt مع السهمين الأفقيين ينقله يوماً، ومع السهمين العموديين ينقله إلى المرحلة السابقة أو التالية؛ ومع Shift يغيّر نهايته، وCtrl مع Shift يغيّر بدايته',
  movedLane: (item, info) => `نُقل «${item.title}» إلى «${info.lane}»، يبدأ ${info.start}`,
};

const englishLaneLabels: CgTimelineLabels = {
  ...englishLabels,
  moveHint: 'Alt and the left and right arrow keys move it a day, and Alt with up or down moves it to the stage above or below; add Shift to change its end, or use Ctrl and Shift to change its start',
  movedLane: (item, info) => `${item.title} moved to ${info.lane}, starting ${info.start}`,
};

/** With links: what blocks a bar and what it blocks, read in its description, lanes moved between too. */
const arabicLinkLabels: CgTimelineLabels = {
  ...arabicLaneLabels,
  blockedBy: (titles) => `تنتظر ${titles}.`,
  blocking: (titles) => `تنتظرها ${titles}.`,
  conflict: (titles, side) => (side === 'blockedBy' ? `تبدأ قبل أن تنتهي ${titles}.` : `${titles} تبدأ قبل أن تنتهي هذه.`),
};

const englishLinkLabels: CgTimelineLabels = {
  ...englishLaneLabels,
  blockedBy: (titles) => `Blocked by ${titles}.`,
  blocking: (titles) => `Blocking ${titles}.`,
  conflict: (titles, side) => (side === 'blockedBy' ? `Starts before ${titles} ends.` : `${titles} starts before this ends.`),
};

const arabicLanes: CgTimelineLane[] = [
  { key: 'plan', title: 'التخطيط' },
  { key: 'build', title: 'التنفيذ' },
  { key: 'review', title: 'المراجعة' },
];

// Colours are the caller's: theme tokens here, so the bars follow light and dark.
const arabicItems: CgTimelineItem[] = [
  { key: 'scope', title: 'تحديد نطاق المشروع', start: '2026-10-26', end: '2026-11-06', lane: 'plan' },
  { key: 'budget', title: 'مراجعة الميزانية', start: '2026-11-09', end: '2026-11-13', lane: 'plan', color: 'var(--cg-warning-text)' },
  { key: 'kickoff', title: 'اجتماع الانطلاق', start: '2026-11-16T07:30:00Z', lane: 'plan', color: 'var(--cg-info-text)' },
  { key: 'suppliers', title: 'التعاقد مع الموردين', start: '2026-11-11', end: '2026-11-25', lane: 'build', color: 'var(--cg-success-text)' },
  { key: 'stock', title: 'جرد المخزون', start: '2026-11-18', end: '2026-11-20', lane: 'build' },
  { key: 'branch', title: 'تجهيز الفرع الجديد', start: '2026-11-23', end: '2026-12-18', lane: 'build', color: 'var(--cg-info-text)' },
  { key: 'payroll', title: 'صرف الرواتب', start: '2026-11-26', lane: 'build', color: 'var(--cg-danger-text)', resizable: false },
  { key: 'audit', title: 'تدقيق الحسابات', start: '2026-12-01', end: '2026-12-10', lane: 'review', color: 'var(--cg-warning-text)' },
  { key: 'filing', title: 'موعد تسليم الإقرار', start: '2026-12-15', lane: 'review', movable: false, resizable: false, color: 'var(--cg-danger-text)' },
  { key: 'report', title: 'تقرير الإدارة', start: '2026-12-14', end: '2026-12-21', lane: 'review' },
  { key: 'training', title: 'تدريب الموظفين', start: '2026-11-30', end: '2026-12-04' },
];

const englishItems: CgTimelineItem[] = [
  { key: 'standup', title: 'Team stand-up', start: '2026-11-16T14:30:00Z', color: 'var(--cg-info-text)' },
  { key: 'close', title: 'Quarter close', start: '2026-11-12', end: '2026-11-18', color: 'var(--cg-success-text)' },
  { key: 'payroll', title: 'Payroll', start: '2026-11-16', color: 'var(--cg-danger-text)' },
  { key: 'filing', title: 'Tax filing due', start: '2026-11-20', movable: false, resizable: false, color: 'var(--cg-danger-text)' },
  { key: 'review', title: 'Invoice review', start: '2026-11-23', end: '2026-11-25' },
  { key: 'holiday', title: 'Thanksgiving', start: '2026-11-26', end: '2026-11-27', movable: false, color: 'var(--cg-warning-text)' },
  { key: 'stock', title: 'Stock count', start: '2026-11-30', end: '2026-12-02', color: 'var(--cg-success-text)' },
];

const englishLanes: CgTimelineLane[] = [
  { key: 'todo', title: 'To do' },
  { key: 'doing', title: 'In progress' },
  { key: 'done', title: 'Done' },
];

const englishLaneOf: Readonly<Record<string, string | undefined>> = { standup: 'doing', close: 'doing', payroll: 'todo', filing: 'todo', review: 'todo', stock: 'done' };
const englishLaneItems: CgTimelineItem[] = englishItems.map((item) => ({ ...item, lane: englishLaneOf[item.key] ?? null }));

/** Writes a move into the caller's items: the new dates, and the lane when it changed. */
const applyMove = (current: CgTimelineItem[], item: CgTimelineItem, details: CgTimelineMoveDetails) => current.map((entry) => (entry.key === item.key
  ? { ...entry, start: details.start, end: details.end, ...(details.lane === undefined ? {} : { lane: details.lane }) }
  : entry));
/** The last action as the browser tests read it, the lane last when it changed. */
const moveAction = (item: CgTimelineItem, details: CgTimelineMoveDetails) => `${details.edge}:${item.key}:${details.start}:${details.end ?? '-'}:${details.source}${details.lane === undefined ? '' : `:${details.lane ?? '-'}`}`;

type PlannerProps = Pick<CgTimelineProps, 'labels' | 'lanes' | 'locale' | 'firstDayOfWeek' | 'timeZone' | 'moveBetweenLanes' | 'links'> & { initial: CgTimelineItem[]; defaultScale: CgTimelineScale };

/** The caller's side: it writes the moves into its own items, and shows the last action and the days shown. */
function Planner({ initial, defaultScale, ...props }: PlannerProps) {
  const [items, setItems] = useState(initial);
  const [scale, setScale] = useState(defaultScale);
  const [lastAction, setLastAction] = useState('');
  const [range, setRange] = useState('');
  return <div style={{ display: 'grid', gap: 8, inlineSize: '100%' }}>
    <CgTimeline
      {...props}
      data-testid="timeline"
      items={items}
      today="2026-11-16"
      defaultStartDate="2026-11-01"
      height="24rem"
      scale={scale}
      onScaleChange={(next) => setScale(next)}
      onRangeChange={(shown) => setRange(`${shown.from}:${shown.to}`)}
      onItemOpen={(item, details) => setLastAction(`open:${item.key}:${details.source}`)}
      onCreate={(date, lane, details) => setLastAction(`create:${date}:${lane ?? '-'}:${details.source}`)}
      onItemMove={(item, details) => {
        setItems((current) => applyMove(current, item, details));
        setLastAction(moveAction(item, details));
      }}
    />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>
      <output data-testid="last-action" dir="ltr">{lastAction}</output>
      <output data-testid="range" dir="ltr">{range}</output>
      <output data-testid="scale" dir="ltr">{scale}</output>
    </div>
  </div>;
}

const arabic = <Planner initial={arabicItems} lanes={arabicLanes} labels={arabicLabels} locale="ar" firstDayOfWeek="saturday" timeZone="Asia/Riyadh" defaultScale="week" />;
const args = { items: [], labels: englishLabels } as never;

// ---- 50,000 items -------------------------------------------------------------------------------
const bigDifference = 'Only the lines in view and the header near the days shown are drawn; each item costs a check of its start until its line is drawn.';
const DAY = 86_400_000;
const isoDay = (offset: number) => new Date(Date.UTC(2026, 0, 1) + offset * DAY).toISOString().slice(0, 10);
const tones = ['var(--cg-info-text)', 'var(--cg-success-text)', 'var(--cg-warning-text)', 'var(--cg-danger-text)', undefined];

const hugeLanes: CgTimelineLane[] = Array.from({ length: 5 }, (_, index) => ({ key: `stage-${index}`, title: `المرحلة ${index + 1}` }));

function manyItems(count: number, inLanes: boolean): CgTimelineItem[] {
  return Array.from({ length: count }, (_, index) => {
    const start = (index * 37) % 700;
    return {
      key: `row-${index}`, title: `مهمة رقم ${index + 1}`, start: isoDay(start), end: isoDay(start + 1 + (index % 13)), color: tones[index % tones.length],
      ...(inLanes ? { lane: `stage-${index % hugeLanes.length}` } : {}),
    };
  });
}

/**
 * Links among many items: each fifth item blocks the next line, or every other time the one 19 lines
 * on (which starts three days after it, 19 × 37 days being 3 more than 700), and one link in fifty
 * reaches 500 lines on, so arrows run out of view too.
 */
function manyLinks(count: number): CgTimelineLink[] {
  return Array.from({ length: count }, (_, index) => {
    const from = index * 5;
    const to = index % 50 === 49 ? (from + 500) % 50_000 : (from + (index % 2 ? 19 : 1)) % 50_000;
    return { id: `link-${index}`, from: `row-${from}`, to: `row-${to}` };
  });
}

/**
 * 50,000 items, with the milliseconds from the timeline's first drawing to its bars being in the
 * page (written once after that first commit, so the timing does not wait for a frame); in five
 * lanes that bars move between with `inLanes`.
 */
function Huge({ inLanes = false, withLinks = false }: { inLanes?: boolean; withLinks?: boolean }) {
  const initial = useMemo(() => manyItems(50_000, inLanes), [inLanes]);
  const links = useMemo(() => (withLinks ? manyLinks(10_000) : undefined), [withLinks]);
  const [items, setItems] = useState(initial);
  const [started] = useState(() => performance.now());
  const elapsed = useRef<HTMLOutputElement>(null);
  const [lastAction, setLastAction] = useState('');
  const [range, setRange] = useState('');
  useLayoutEffect(() => {
    if (elapsed.current) elapsed.current.textContent = String(Math.round(performance.now() - started));
  }, [started]);
  return <div style={{ display: 'grid', gap: 8, inlineSize: '100%' }}>
    <CgTimeline
      data-testid="timeline"
      items={items}
      labels={withLinks ? arabicLinkLabels : inLanes ? arabicLaneLabels : arabicLabels}
      links={links}
      lanes={inLanes ? hugeLanes : undefined}
      moveBetweenLanes={inLanes}
      locale="ar"
      firstDayOfWeek="saturday"
      timeZone="Asia/Riyadh"
      today="2026-11-16"
      defaultStartDate="2026-01-01"
      defaultScale="month"
      height="26rem"
      onRangeChange={(shown) => setRange(`${shown.from}:${shown.to}`)}
      onItemOpen={(item, details) => setLastAction(`open:${item.key}:${details.source}`)}
      onItemMove={(item, details) => {
        setItems((current) => applyMove(current, item, details));
        setLastAction(moveAction(item, details));
      }}
    />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>
      <span>العناصر: <output data-testid="item-count" dir="ltr">{items.length}</output></span>
      <span>أول رسم (ms): <output ref={elapsed} data-testid="first-draw-ms" dir="ltr" /></span>
      <output data-testid="last-action" dir="ltr">{lastAction}</output>
      <output data-testid="range" dir="ltr">{range}</output>
    </div>
  </div>;
}

// ---- Items with no date dropped onto a day, as Cash Gear Workspace has ---------------------------
const undatedDifference = 'The list of items with no date is the caller\'s: it drags them with cgTrackDrag and finds the day and lane under the pointer with the handle\'s dateAt and laneAt.';

interface UndatedEntry { key: string; title: string }

const undatedEntries: UndatedEntry[] = [
  { key: 'supplier', title: 'تحديث بيانات المورد' },
  { key: 'quote', title: 'طلب عرض سعر' },
  { key: 'renewal', title: 'تجديد الاشتراك' },
];

function UndatedPlanner() {
  const timeline = useRef<CgTimelineHandle>(null);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  const [items, setItems] = useState(arabicItems);
  const [undated, setUndated] = useState(undatedEntries);
  const [firstShown, setFirstShown] = useState('2026-11-01');
  const [lastAction, setLastAction] = useState('');

  useEffect(() => () => stopDrag.current?.(), []);

  const place = (entry: UndatedEntry, date: string, lane: string | null, how: 'pointer' | 'button') => {
    setUndated((list) => list.filter((candidate) => candidate.key !== entry.key));
    setItems((list) => [...list, { key: entry.key, title: entry.title, start: date, lane }]);
    setLastAction(`place:${entry.key}:${date}:${lane ?? '-'}:${how}`);
    live.current?.announce(`وُضع «${entry.title}» في ${date}`);
  };

  // The drag is the caller's: the timeline only says which day and lane are under the pointer, and marks the day.
  const startDrag = (event: PointerEvent<HTMLLIElement>, entry: UndatedEntry) => {
    if (event.button !== 0 || !cgStartsDrag(event.target, event.currentTarget)) return;
    stopDrag.current?.();
    stopDrag.current = cgTrackDrag(event, event.currentTarget, {
      onMove: (x, y) => timeline.current?.markDropDate(timeline.current.dateAt(x, y)),
      onDrop: (x, y) => {
        stopDrag.current = null;
        timeline.current?.markDropDate(null);
        const date = timeline.current?.dateAt(x, y);
        if (date) place(entry, date, timeline.current?.laneAt(x, y)?.lane ?? null, 'pointer');
      },
      onCancel: () => {
        stopDrag.current = null;
        timeline.current?.markDropDate(null);
      },
    });
  };

  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: 12, inlineSize: '100%' }}>
    <CgTimeline
      actionsRef={timeline}
      data-testid="timeline"
      style={{ flex: '1 1 32rem', minInlineSize: 0 }}
      items={items}
      lanes={arabicLanes}
      labels={arabicLabels}
      locale="ar"
      firstDayOfWeek="saturday"
      timeZone="Asia/Riyadh"
      today="2026-11-16"
      defaultStartDate="2026-11-01"
      height="22rem"
      onRangeChange={(shown) => setFirstShown(shown.from)}
      onItemOpen={(item, details) => setLastAction(`open:${item.key}:${details.source}`)}
      onItemMove={(item, details) => {
        setItems((current) => current.map((entry) => (entry.key === item.key ? { ...entry, start: details.start, end: details.end } : entry)));
        setLastAction(`${details.edge}:${item.key}:${details.start}:${details.end ?? '-'}:${details.source}`);
      }}
    />
    <div style={{ display: 'grid', flex: '1 1 12rem', gap: 8, minInlineSize: 0 }}>
      <div id="timeline-undated" style={{ color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)', fontWeight: 'var(--cg-font-weight-medium)' }}>بلا تاريخ</div>
      <ul aria-labelledby="timeline-undated" data-testid="undated-list" style={{ display: 'grid', gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
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
          <CgButton appearance="ghost" size="small" aria-label={`ضع «${entry.title}» في أول يوم ظاهر`} title={`ضع «${entry.title}» في أول يوم ظاهر`} onClick={() => place(entry, firstShown, null, 'button')}>
            <CgIcon name="calendar" />
          </CgButton>
        </li>)}
      </ul>
      {undated.length ? null : <div style={{ color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>لا عناصر بلا تاريخ</div>}
      <span style={{ color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>آخر إجراء: <output data-testid="last-action" dir="ltr">{lastAction}</output></span>
    </div>
    <CgLiveAnnouncer ref={live} />
  </div>;
}

/** Lanes that collapse, the week scale, and the scale buttons; time runs from right to left. */
export const ArabicLanes: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabic}</StoryFrame>, globals: { direction: 'rtl' } };
export const ArabicLanesDark: Story = { args, render: () => <StoryFrame source={source} difference={difference}>{arabic}</StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
/** Left to right, weeks from Sunday, the day scale, no lanes, quarters named by the caller. */
export const EnglishDays: Story = {
  args,
  render: () => <StoryFrame source={source} difference={difference}>
    <Planner initial={englishItems} labels={englishLabels} locale="en-US" firstDayOfWeek="sunday" timeZone="America/New_York" defaultScale="day" />
  </StoryFrame>,
};
export const FiftyThousandItems: Story = { args, render: () => <StoryFrame source={source} difference={bigDifference}><Huge /></StoryFrame>, globals: { direction: 'rtl' } };

// ---- Moving between lanes (Track U19) -----------------------------------------------------------
const laneSource = 'None: React only (Cash Gear Workspace Track U19, the timeline view\'s lanes by a select or status property)';
const laneDifference = 'With moveBetweenLanes, a bar dragged onto another lane, or moved by Alt+ArrowUp and Alt+ArrowDown, changes its lane and its days in one onItemMove; the caller writes both.';

/** Bars dragged onto another lane's lines or header (the lane marked while dragging), or moved a lane up or down by keys; time runs from right to left. */
export const ArabicLaneMoves: Story = {
  args,
  render: () => <StoryFrame source={laneSource} difference={laneDifference}>
    <Planner initial={arabicItems} lanes={arabicLanes} labels={arabicLaneLabels} locale="ar" firstDayOfWeek="saturday" timeZone="Asia/Riyadh" defaultScale="week" moveBetweenLanes />
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
/** The same left to right, at the day scale. */
export const EnglishLaneMoves: Story = {
  args,
  render: () => <StoryFrame source={laneSource} difference={laneDifference}>
    <Planner initial={englishLaneItems} lanes={englishLanes} labels={englishLaneLabels} locale="en-US" firstDayOfWeek="sunday" timeZone="America/New_York" defaultScale="day" moveBetweenLanes />
  </StoryFrame>,
};
/** 50,000 items in five lanes, a bar moved to another lane followed to its new line. */
export const FiftyThousandInLanes: Story = { args, render: () => <StoryFrame source={laneSource} difference={bigDifference}><Huge inLanes /></StoryFrame>, globals: { direction: 'rtl' } };
/** Items with no date dragged onto a day and lane, or placed on the first day shown. */
export const ArabicUndatedDrop: Story = { args, render: () => <StoryFrame source={source} difference={undatedDifference}><UndatedPlanner /></StoryFrame>, globals: { direction: 'rtl' } };

// ---- Links between bars (Track U20) -------------------------------------------------------------
const linkSource = 'None: React only (Cash Gear Workspace Track U20, dependencies on the timeline view: "Blocked by" and "Blocking")';
const linkDifference = 'Arrows from a blocker\'s end to what it blocks, routed round the bars, dashed red when the blocked item starts before its blocker ends; each bar\'s description names them. Display only.';

// Two of them in conflict: the suppliers' contract ends after the new branch starts, and the training after the audit starts.
const arabicLinks: CgTimelineLink[] = [
  { id: 'scope-budget', from: 'scope', to: 'budget' },
  { id: 'scope-suppliers', from: 'scope', to: 'suppliers' },
  { id: 'budget-kickoff', from: 'budget', to: 'kickoff' },
  { id: 'stock-branch', from: 'stock', to: 'branch' },
  { id: 'suppliers-branch', from: 'suppliers', to: 'branch' },
  { id: 'training-audit', from: 'training', to: 'audit' },
  { id: 'audit-report', from: 'audit', to: 'report' },
];

// Stand-up and payroll fall on the same day: a conflict.
const englishLinks: CgTimelineLink[] = [
  { id: 'close-review', from: 'close', to: 'review' },
  { id: 'standup-payroll', from: 'standup', to: 'payroll' },
  { id: 'review-stock', from: 'review', to: 'stock' },
  { id: 'filing-holiday', from: 'filing', to: 'holiday' },
];

/** Links between bars in lanes that move between lanes; the arrows follow a dragged or resized bar; time runs from right to left. */
export const ArabicLinks: Story = {
  args,
  render: () => <StoryFrame source={linkSource} difference={linkDifference}>
    <Planner initial={arabicItems} lanes={arabicLanes} labels={arabicLinkLabels} links={arabicLinks} locale="ar" firstDayOfWeek="saturday" timeZone="Asia/Riyadh" defaultScale="week" moveBetweenLanes />
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
export const ArabicLinksDark: Story = { ...ArabicLinks, globals: { theme: 'dark', direction: 'rtl' } };
/** The same left to right, at the day scale. */
export const EnglishLinks: Story = {
  args,
  render: () => <StoryFrame source={linkSource} difference={linkDifference}>
    <Planner initial={englishLaneItems} lanes={englishLanes} labels={englishLinkLabels} links={englishLinks} locale="en-US" firstDayOfWeek="sunday" timeZone="America/New_York" defaultScale="day" moveBetweenLanes />
  </StoryFrame>,
};
/** 50,000 items with 10,000 links: only the links of the lines in view are drawn. */
export const FiftyThousandWithLinks: Story = { args, render: () => <StoryFrame source={linkSource} difference={bigDifference}><Huge withLinks /></StoryFrame>, globals: { direction: 'rtl' } };
