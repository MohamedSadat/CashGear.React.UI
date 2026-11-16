import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgKanbanBoard } from './CgKanbanBoard';
import type { CgKanbanBoardLabels, CgKanbanCard, CgKanbanColumn } from './CgKanbanBoard.types';
import { moveKanbanCard } from './kanbanLayout';

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
