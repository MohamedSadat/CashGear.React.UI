import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgInlineTextEditor } from '../InlineEditor';
import { CgStatusBadge } from '../StatusBadge';
import type { CgStatusBadgeType } from '../StatusBadge';
import { CgKanbanBoard } from './CgKanbanBoard';
import type { CgKanbanBoardLabels, CgKanbanCard, CgKanbanColumn } from './CgKanbanBoard.types';
import { moveKanbanCard, moveKanbanColumn } from './kanbanLayout';

const source = 'None: React only (Cash Gear Workspace Track U14, the database board view)';
const difference = 'Generic columns and cards drawn by renderCard; drags, keys and the handle menu report one onCardMove, and a long column draws only the cards in view.';
const meta = { title: 'Phase 37/KanbanBoard', component: CgKanbanBoard, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgKanbanBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

interface Task { owner: string; amount: number }

const dot = (color: string): ReactNode => <span style={{ display: 'inline-block', inlineSize: 8, blockSize: 8, borderRadius: '50%', background: color }} />;

function tasks(columnKey: string, count: number, titles: readonly string[], owners: readonly string[], number: (n: number) => string): Array<CgKanbanCard<Task>> {
  return Array.from({ length: count }, (_, index) => ({
    key: `${columnKey}-${index + 1}`,
    columnKey,
    label: `${titles[index % titles.length]!} ${number(index + 1)}`,
    data: { owner: owners[index % owners.length]!, amount: 1250 + ((index * 731) % 9000) },
  }));
}

function renderTask(card: CgKanbanCard<Task>) {
  return <div style={{ display: 'grid', gap: 4 }}>
    <span dir="auto" style={{ overflow: 'hidden', fontWeight: 'var(--cg-font-weight-medium)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.label}</span>
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>
      <span dir="auto">{card.data?.owner}</span>
      <span>{card.data?.amount.toLocaleString('en-US')}</span>
    </span>
  </div>;
}

// ---- Arabic --------------------------------------------------------------------------------------

const arabicColumns: Array<CgKanbanColumn> = [
  { key: 'none', title: 'بلا حالة', icon: dot('var(--cg-border-strong)') },
  { key: 'todo', title: 'لم يبدأ', icon: dot('var(--cg-text-secondary)') },
  { key: 'doing', title: 'قيد التنفيذ', icon: dot('var(--cg-info-text)') },
  { key: 'review', title: 'قيد المراجعة', icon: dot('var(--cg-warning-text)') },
  { key: 'done', title: 'منجز', icon: dot('var(--cg-success-text)') },
  { key: 'archive', title: 'مؤرشف', hidden: true },
];
const arabicTitles = ['مراجعة فاتورة المورد', 'تسوية حساب البنك', 'إعداد تقرير الضريبة', 'اعتماد أمر الشراء', 'تحديث قائمة الأسعار', 'مطابقة المخزون'];
const arabicOwners = ['سارة', 'أحمد', 'ليلى', 'عمر'];
const arabicNumber = (n: number) => `رقم ${n}`;
const arabicCards: Array<CgKanbanCard<Task>> = [
  ...tasks('todo', 300, arabicTitles, arabicOwners, arabicNumber),
  ...tasks('doing', 6, arabicTitles.slice(2), arabicOwners, arabicNumber),
  ...tasks('review', 3, arabicTitles.slice(4), arabicOwners, arabicNumber),
  ...tasks('done', 4, arabicTitles.slice(1), arabicOwners, arabicNumber),
  ...tasks('archive', 2, arabicTitles, arabicOwners, arabicNumber),
];
const arabicLabels: CgKanbanBoardLabels<Task> = {
  board: 'لوحة مهام الحسابات',
  column: (column, count) => `${column.title}، ${count} بطاقة`,
  emptyColumn: 'لا توجد بطاقات',
  cardHint: 'المسافة تلتقط البطاقة والأسهم تنقلها، وEnter يفتحها، وShift+F10 يفتح قائمتها',
  cardHandle: (card) => `نقل «${card.label}»`,
  pickedUp: (card, column, index, count) => `التُقطت «${card.label}»، ${index + 1} من ${count} في ${column.title}`,
  position: (_card, column, index, count) => `${column.title}، ${index + 1} من ${count}`,
  moved: (card, column, index, count) => `نُقلت «${card.label}» إلى ${column.title}، ${index + 1} من ${count}`,
  cancelled: (card) => `بقيت «${card.label}» في مكانها`,
  moveToColumn: (column) => `نقل إلى ${column.title}`,
  moveUp: 'نقل لأعلى',
  moveDown: 'نقل لأسفل',
  addCard: (column) => `بطاقة جديدة في ${column.title}`,
  collapseColumn: (column) => `طي ${column.title}`,
  expandColumn: (column) => `توسيع ${column.title}`,
  hiddenColumns: 'أعمدة مخفية',
  showColumn: (column) => `إظهار ${column.title}`,
};

// ---- English -------------------------------------------------------------------------------------

const englishColumns: Array<CgKanbanColumn> = [
  { key: 'none', title: 'No status', icon: dot('var(--cg-border-strong)') },
  { key: 'todo', title: 'Not started', icon: dot('var(--cg-text-secondary)') },
  { key: 'doing', title: 'In progress', icon: dot('var(--cg-info-text)') },
  { key: 'done', title: 'Done', icon: dot('var(--cg-success-text)') },
  { key: 'archive', title: 'Archived', hidden: true },
];
const englishTitles = ['Review the supplier invoice', 'Reconcile the bank account', 'Prepare the tax report', 'Approve the purchase order', 'Update the price list'];
const englishOwners = ['Sara', 'Ahmed', 'Laila', 'Omar'];
const englishNumber = (n: number) => `#${n}`;
const englishCards: Array<CgKanbanCard<Task>> = [
  ...tasks('todo', 300, englishTitles, englishOwners, englishNumber),
  ...tasks('doing', 5, englishTitles.slice(1), englishOwners, englishNumber),
  ...tasks('done', 3, englishTitles.slice(2), englishOwners, englishNumber),
  ...tasks('archive', 2, englishTitles, englishOwners, englishNumber),
];
const englishLabels: CgKanbanBoardLabels<Task> = {
  board: 'Accounts tasks board',
  column: (column, count) => `${column.title}, ${count} cards`,
  emptyColumn: 'No cards',
  cardHint: 'Space picks the card up and the arrows move it, Enter opens it, Shift+F10 opens its menu',
  cardHandle: (card) => `Move ${card.label}`,
  pickedUp: (card, column, index, count) => `Picked up ${card.label}, ${index + 1} of ${count} in ${column.title}`,
  position: (_card, column, index, count) => `${column.title}, ${index + 1} of ${count}`,
  moved: (card, column, index, count) => `${card.label} moved to ${column.title}, ${index + 1} of ${count}`,
  cancelled: (card) => `${card.label} stays where it was`,
  moveToColumn: (column) => `Move to ${column.title}`,
  moveUp: 'Move up',
  moveDown: 'Move down',
  addCard: (column) => `New card in ${column.title}`,
  collapseColumn: (column) => `Collapse ${column.title}`,
  expandColumn: (column) => `Expand ${column.title}`,
  hiddenColumns: 'Hidden columns',
  showColumn: (column) => `Show ${column.title}`,
};

// ---- The fixture ---------------------------------------------------------------------------------

interface FixtureProps {
  columns: Array<CgKanbanColumn>;
  cards: Array<CgKanbanCard<Task>>;
  labels: CgKanbanBoardLabels<Task>;
  openText: string;
  newCard: (n: number) => string;
  owner: string;
}

/** A board that applies its moves, and shows the last move and the last card opened. */
function Fixture({ columns: initialColumns, cards: initialCards, labels, openText, newCard, owner }: FixtureProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [cards, setCards] = useState(initialCards);
  const [lastMove, setLastMove] = useState('');
  const [opened, setOpened] = useState('');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 8, inlineSize: '100%', minInlineSize: 0 }}>
      <CgKanbanBoard<Task>
        data-testid="kanban-board"
        style={{ blockSize: '30rem', border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}
        columns={columns}
        cards={cards}
        labels={labels}
        renderCard={renderTask}
        cardSize={64}
        collapsible
        onCardMove={(key, toColumnKey, toIndex, details) => {
          setCards((current) => moveKanbanCard(current, key, toColumnKey, toIndex));
          setLastMove(`${key} ${details.fromColumnKey}:${details.fromIndex} → ${toColumnKey}:${toIndex} (${details.source})`);
        }}
        onCardOpen={(key) => setOpened(key)}
        onAddCard={(columnKey) => setCards((current) => {
          const n = current.filter((card) => card.key.startsWith('new-')).length + 1;
          return [...current, { key: `new-${n}`, columnKey, label: newCard(n), data: { owner, amount: 0 } }];
        })}
        onShowColumn={(key) => setColumns((current) => current.map((column) => (column.key === key ? { ...column, hidden: false } : column)))}
        cardMenuItems={(card) => [{ key: 'open', text: openText, command: () => setOpened(card.key) }]}
      />
      <output data-testid="last-move">{lastMove}</output>
      <output data-testid="opened-card">{opened}</output>
    </div>
  </StoryFrame>;
}

const arabic = () => <Fixture columns={arabicColumns} cards={arabicCards} labels={arabicLabels} openText="فتح" newCard={(n) => `بطاقة جديدة ${n}`} owner="سارة" />;

export const ArabicBoard: Story = {
  args: { columns: [], cards: [], labels: arabicLabels, renderCard: () => null } as never,
  render: arabic,
  globals: { direction: 'rtl' },
};

export const ArabicBoardDark: Story = {
  args: { columns: [], cards: [], labels: arabicLabels, renderCard: () => null } as never,
  render: arabic,
  globals: { theme: 'dark', direction: 'rtl' },
};

export const LeftToRight: Story = {
  args: { columns: [], cards: [], labels: englishLabels, renderCard: () => null } as never,
  render: () => <Fixture columns={englishColumns} cards={englishCards} labels={englishLabels} openText="Open" newCard={(n) => `New card ${n}`} owner="Sara" />,
};

// ---- Columns that move, a paged column, a draft card and coloured titles (Arabic) ------------------

const columnsDifference = 'Columns move by their header (drag, grip keys or grip menu) with one onColumnMove; a column ends with the caller’s footer, says once per number of cards that its end came into view, and can show a draft card.';

interface Status { tone: CgStatusBadgeType }

const PAGE = 20;
const pagedColumns: Array<CgKanbanColumn<Status>> = [
  { key: 'todo', title: 'لم يبدأ', data: { tone: 'neutral' } },
  { key: 'doing', title: 'قيد التنفيذ', data: { tone: 'info' } },
  { key: 'review', title: 'قيد المراجعة', data: { tone: 'warning' } },
  { key: 'blocked', title: 'متوقف', data: { tone: 'error' } },
  { key: 'done', title: 'منجز', data: { tone: 'success' } },
];
/** The paged column's cards on the "server": the board has the first page at the start. */
const pagedTodo = tasks('todo', 80, arabicTitles, arabicOwners, arabicNumber);
const pagedCards: Array<CgKanbanCard<Task>> = [
  ...pagedTodo.slice(0, PAGE),
  ...tasks('doing', 4, arabicTitles.slice(2), arabicOwners, arabicNumber),
  ...tasks('review', 2, arabicTitles.slice(4), arabicOwners, arabicNumber),
  ...tasks('done', 3, arabicTitles.slice(1), arabicOwners, arabicNumber),
];
const pagedLabels: CgKanbanBoardLabels<Task, Status> = {
  ...arabicLabels,
  columnHandle: (column) => `نقل العمود ${column.title}`,
  columnHint: 'المسافة ترفع العمود، ثم تنقله مفاتيح الأسهم وتضعه المسافة، ويفتح Shift+F10 قائمته',
  columnPickedUp: (column, index, count) => `رُفع العمود ${column.title}، الموضع ${index + 1} من ${count}`,
  columnPosition: (column, index, count) => `${column.title}، الموضع ${index + 1} من ${count}`,
  columnMoved: (column, index, count) => `نُقل العمود ${column.title} إلى الموضع ${index + 1} من ${count}`,
  columnCancelled: (column) => `بقي العمود ${column.title} في مكانه`,
  // In right to left the row starts on the right.
  moveColumnPrevious: 'نقل لليمين',
  moveColumnNext: 'نقل لليسار',
};

/** A column's title as its status's coloured chip. */
const statusChip = (column: CgKanbanColumn<Status>) => {
  const tone = column.data?.tone ?? 'neutral';
  return <CgStatusBadge dir="auto" text={column.title} type={tone} appearance={tone === 'neutral' ? 'outline' : 'soft'} indicator />;
};

const footButton: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minBlockSize: 28,
  paddingInline: 8,
  border: 0,
  borderRadius: 'var(--cg-radius-sm)',
  background: 'transparent',
  color: 'var(--cg-text-secondary)',
  font: 'inherit',
  fontSize: 'var(--cg-font-size-sm)',
  textAlign: 'start',
  cursor: 'pointer',
};

interface PagedData {
  cards: Array<CgKanbanCard<Task>>;
  /** Cards not loaded yet, by column. */
  remaining: Array<CgKanbanCard<Task>>;
  added: number;
}

/**
 * Columns that move, a paged column that loads its next page when its end comes into view (or
 * from its footer's "تحميل المزيد"), a draft card where a new card's title is typed, and the
 * columns' titles drawn as coloured chips.
 */
function ColumnsFixture() {
  const [columns, setColumns] = useState(pagedColumns);
  const [data, setData] = useState<PagedData>(() => ({ cards: pagedCards, remaining: pagedTodo.slice(PAGE), added: 0 }));
  const [draft, setDraft] = useState<string | null>('doing');
  // The draft shown at the start waits to be focused; one opened from a footer takes the focus.
  const [draftFocus, setDraftFocus] = useState(false);
  const [lastMove, setLastMove] = useState('');
  const [lastColumnMove, setLastColumnMove] = useState('');
  const [endCalls, setEndCalls] = useState<string[]>([]);
  const [draftText, setDraftText] = useState('');
  // Each column's count is its total: the cards loaded and those not loaded yet.
  const shown = useMemo(() => columns.map((column) => ({
    ...column,
    count: data.cards.filter((card) => card.columnKey === column.key).length + data.remaining.filter((card) => card.columnKey === column.key).length,
  })), [columns, data]);
  const loadMore = (columnKey: string) => setData((current) => {
    const page = current.remaining.filter((card) => card.columnKey === columnKey).slice(0, PAGE);
    return page.length ? { ...current, cards: [...current.cards, ...page], remaining: current.remaining.filter((card) => !page.includes(card)) } : current;
  });
  return <StoryFrame source={source} difference={columnsDifference}>
    <div style={{ display: 'grid', gap: 8, inlineSize: '100%', minInlineSize: 0 }}>
      <CgKanbanBoard<Task, Status>
        data-testid="kanban-board"
        style={{ blockSize: '30rem', border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}
        columns={shown}
        cards={data.cards}
        labels={pagedLabels}
        renderCard={renderTask}
        cardSize={64}
        renderColumnTitle={statusChip}
        onCardMove={(key, toColumnKey, toIndex, details) => {
          setData((current) => ({ ...current, cards: moveKanbanCard(current.cards, key, toColumnKey, toIndex) }));
          setLastMove(`${key} ${details.fromColumnKey}:${details.fromIndex} → ${toColumnKey}:${toIndex} (${details.source})`);
        }}
        onColumnMove={(key, toIndex, details) => {
          setColumns((current) => moveKanbanColumn(current, key, toIndex));
          setLastColumnMove(`${key} ${details.fromIndex} → ${toIndex} (${details.source})`);
        }}
        onColumnEndReached={(key) => {
          const loaded = data.cards.filter((card) => card.columnKey === key).length;
          setEndCalls((current) => [...current, `${key}@${loaded}`]);
          loadMore(key);
        }}
        renderColumnFooter={(column) => {
          const more = data.remaining.some((card) => card.columnKey === column.key);
          const drafting = draft === column.key;
          if (!more && drafting) return null;
          return <>
            {more ? <button type="button" style={footButton} onClick={() => loadMore(column.key)}>تحميل المزيد</button> : null}
            {drafting ? null : <button
              type="button"
              style={footButton}
              aria-label={`بطاقة جديدة في ${column.title}`}
              onClick={() => {
                setDraftFocus(true);
                setDraft(column.key);
              }}
            ><span aria-hidden="true">＋</span>بطاقة جديدة</button>}
          </>;
        }}
        draftColumn={draft}
        renderDraft={(column) => <CgInlineTextEditor
          label={`عنوان البطاقة الجديدة في ${column.title}`}
          defaultValue=""
          placeholder="اكتب عنوان البطاقة"
          autoFocus={draftFocus}
          onCommit={(text) => {
            const title = text.trim();
            if (!title) return;
            setDraftText(title);
            setData((current) => ({
              ...current,
              added: current.added + 1,
              cards: [...current.cards, { key: `new-${current.added + 1}`, columnKey: column.key, label: title, data: { owner: 'سارة', amount: 0 } }],
            }));
          }}
          onDone={() => setDraft(null)}
        />}
      />
      <output data-testid="last-column-move">{lastColumnMove}</output>
      <output data-testid="end-reached">{endCalls.join(' ')}</output>
      <output data-testid="draft-text">{draftText}</output>
      <output data-testid="last-move">{lastMove}</output>
    </div>
  </StoryFrame>;
}

export const ArabicColumnsAndPaging: Story = {
  args: { columns: [], cards: [], labels: arabicLabels, renderCard: () => null } as never,
  render: () => <ColumnsFixture />,
  globals: { direction: 'rtl' },
};
