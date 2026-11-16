import { useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgIcon } from '../Icon';
import { CgTreeView } from './CgTreeView';
import type { CgTreeViewActions, CgTreeViewDropCandidate, CgTreeViewMoveDetails, CgTreeViewNodeDescriptor } from './CgTreeView.types';

const source = 'CG.CompLib/Comp/TreeView/*; CG.CompLib.Tests/CgTreeViewTests.cs; CG.CompLib.Demo/Components/Pages/TreeViewDemo.razor';
const difference = 'React uses immutable nested or flat descriptors, ReadonlySet-controlled state, SSR-safe IDs, safe text fragments, and the Phase 10 ContextMenu engine; Razor node registration is intentionally not exposed.';
const meta: Meta<typeof CgTreeView> = {
  title: 'Phase 12/TreeView',
  component: CgTreeView,
  parameters: parityParameters(source, difference),
};
export default meta;
type Story = StoryObj<typeof meta>;

const catalog: ReadonlyArray<CgTreeViewNodeDescriptor> = [
  { key: 'products', text: 'Products', icon: <span>▣</span>, children: [
    { key: 'hardware', text: 'Hardware', icon: <span>▣</span>, children: [
      { key: 'keyboard', text: 'Mechanical Keyboard', searchText: 'typing usb' },
      { key: 'mouse', text: 'Wireless Mouse', searchText: 'pointing bluetooth' },
      { key: 'legacy', text: 'Legacy Adapter', disabled: true },
    ] },
    { key: 'software', text: 'Software', icon: <span>▣</span>, children: [
      { key: 'accounting', text: 'Accounting Suite' },
      { key: 'crm', text: 'CRM' },
    ] },
  ] },
  { key: 'services', text: 'Services', children: [
    { key: 'installation', text: 'Installation' },
    { key: 'support', text: 'Support' },
  ] },
];

const flat: ReadonlyArray<CgTreeViewNodeDescriptor> = [
  { key: 'company', text: 'CashGear', parentKey: null },
  { key: 'finance', text: 'Finance', parentKey: 'company' },
  { key: 'sales', text: 'Sales', parentKey: 'company' },
  { key: 'receivables', text: 'Receivables', parentKey: 'finance' },
  { key: 'payables', text: 'Payables', parentKey: 'finance' },
];

function ControlledExample() {
  const [selected, setSelected] = useState<string | null>('keyboard');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(['products', 'hardware']));
  return <StoryFrame source={source} difference={difference}>
    <CgTreeView nodes={catalog} selectedKey={selected} onSelectedKeyChange={setSelected} expandedKeys={expanded} onExpandedKeysChange={setExpanded} aria-label="Controlled product tree" />
    <p data-testid="tree-state">Selected: {selected ?? 'none'}; expanded: {[...expanded].join(', ') || 'none'}</p>
  </StoryFrame>;
}

function DynamicExample() {
  const [showMouse, setShowMouse] = useState(true);
  const nodes: ReadonlyArray<CgTreeViewNodeDescriptor> = [{ key: 'root', text: 'Devices', children: [
    { key: 'keyboard', text: 'Keyboard' },
    ...(showMouse ? [{ key: 'mouse', text: 'Mouse' }] : []),
  ] }];
  return <StoryFrame source={source} difference={difference}>
    <button type="button" data-testid="toggle-mouse" onClick={() => setShowMouse((value) => !value)}>Toggle mouse</button>
    <CgTreeView nodes={nodes} defaultExpandedKeys={new Set(['root'])} defaultSelectedKey="mouse" />
  </StoryFrame>;
}

function KeyboardFocusExample() {
  const actions = useRef<CgTreeViewActions>(null);
  useEffect(() => { void actions.current?.focus('hardware'); }, []);
  return <CgTreeView nodes={catalog} actionsRef={actions} defaultExpandedKeys={new Set(['products'])} aria-label="Keyboard focused tree" />;
}

export const NestedDescriptors: Story = { args: { nodes: catalog, defaultExpandedKeys: new Set(['products', 'hardware']), 'aria-label': 'Product catalog' } };
export const FlatParentKeys: Story = { args: { nodes: flat, defaultExpandedKeys: new Set(['company', 'finance']), size: 'small', 'aria-label': 'Organization tree' } };
export const ControlledSelectionExpansion: Story = { render: () => <ControlledExample /> };
export const MultipleChecking: Story = { args: { nodes: catalog, checkMode: 'multiple', defaultExpandedKeys: new Set(['products', 'hardware']), defaultCheckedKeys: new Set(['keyboard']) } };
export const RecursiveChecking: Story = { args: { nodes: catalog, checkMode: 'recursive', defaultExpandedKeys: new Set(['products', 'hardware']), defaultCheckedKeys: new Set(['keyboard']) } };
export const Filtering: Story = { args: { nodes: catalog, showFilterPanel: true, defaultFilterText: 'bluetooth', defaultExpandedKeys: new Set(['services']) } };
export const DynamicRemoval: Story = { render: () => <DynamicExample /> };
export const ContextMenus: Story = { args: { nodes: catalog, contextMenuAreas: 'all', checkMode: 'multiple', defaultExpandedKeys: new Set(['products']) } };
export const DisabledReadOnly: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 16 }}><CgTreeView nodes={catalog} disabled defaultExpandedKeys={new Set(['products'])} aria-label="Disabled tree" /><CgTreeView nodes={catalog} readOnly defaultExpandedKeys={new Set(['products'])} aria-label="Read-only tree" /></div></StoryFrame> };
export const EmptyTree: Story = { args: { nodes: [], renderEmpty: () => <p data-testid="tree-empty">Nothing to display.</p> } };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, args: { nodes: catalog, size: 'small', checkMode: 'recursive', defaultExpandedKeys: new Set(['products', 'hardware']), defaultCheckedKeys: new Set(['keyboard', 'mouse', 'hardware']) } };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 310 }}><CgTreeView direction="rtl" nodes={[{ key: 'sales-ar', text: 'المبيعات والتوزيع', children: [{ key: 'orders-ar', text: 'طلبات العملاء طويلة الوصف التي تلتف داخل المساحة الضيقة' }, { key: 'invoices-ar', text: 'الفواتير' }] }]} defaultExpandedKeys={new Set(['sales-ar'])} aria-label="شجرة التنقل" /></div> };
export const NarrowWrappingLabels: Story = { render: () => <div style={{ width: 260 }}><CgTreeView nodes={[{ key: 'long', text: 'A very long operational category that wraps naturally in a narrow sidebar', children: [{ key: 'detail', text: 'Detailed child label with additional explanatory wording' }] }]} defaultExpandedKeys={new Set(['long'])} /></div> };
export const KeyboardFocusedState: Story = { render: () => <KeyboardFocusExample /> };
export const SelectedExpanded: Story = { args: { nodes: catalog, defaultSelectedKey: 'mouse', defaultExpandedKeys: new Set(['products', 'hardware']) } };

// ---- Phase 37 (Track U4): the Workspace page tree's drag and drop, inline rename, lazy children and virtual rows.
const pageTreeSource = 'None: React only (Cash Gear Workspace Track U4, the sidebar page tree: packages/shell/src/sidebar/PageTree.tsx)';
const pageTreeDifference = 'Moves, renames and loads are reported, never applied: the story owns the pages. Rows drag by pointer or Alt+Shift with an arrow key; F2, a double click or the menu renames; lazy pages load on expand.';

interface Page {
  key: string;
  title: string;
  kind?: 'section' | 'page' | 'database';
  /** The account may only view it. */
  viewOnly?: boolean;
  /** Children loaded on expand: `ok` loads, `fail` fails once and loads on retry. */
  lazy?: 'ok' | 'fail';
  children?: Page[];
}

const LAZY_CHILDREN: Readonly<Record<string, Page[]>> = {
  archive: [{ key: 'archive-2024', title: 'أرشيف ٢٠٢٤' }, { key: 'archive-2025', title: 'أرشيف ٢٠٢٥' }],
  shared: [{ key: 'shared-budget', title: 'الميزانية المشتركة' }, { key: 'shared-hr', title: 'سياسات الموارد البشرية' }],
};
const initialPages: Page[] = [
  { key: 'workspace', title: 'المساحة', kind: 'section', children: [
    { key: 'start', title: 'البداية', children: [{ key: 'welcome', title: 'مرحبًا بك' }, { key: 'guide', title: 'دليل الاستخدام' }] },
    { key: 'projects', title: 'المشاريع', children: [{ key: 'website', title: 'الموقع الإلكتروني' }, { key: 'payroll', title: 'الرواتب' }] },
    { key: 'tasks', title: 'قاعدة بيانات المهام', kind: 'database' },
    { key: 'archive', title: 'الأرشيف', lazy: 'ok' },
    { key: 'shared', title: 'مصدر مشترك', lazy: 'fail' },
    { key: 'policy', title: 'سياسة الشركة', viewOnly: true },
  ] },
  { key: 'private', title: 'خاص', kind: 'section', children: [
    { key: 'notes', title: 'ملاحظاتي' },
    { key: 'draft', title: '' },
  ] },
];

function pageNodes(pages: ReadonlyArray<Page>): CgTreeViewNodeDescriptor<Page>[] {
  return pages.map((page) => ({
    key: page.key,
    text: page.title || 'بلا عنوان',
    renameText: page.title,
    item: page,
    icon: page.kind === 'section' ? undefined : page.kind === 'database' ? 'database' : 'page',
    allowDrag: page.kind !== 'section' && !page.viewOnly,
    allowRename: page.kind !== 'section' && !page.viewOnly,
    ...(page.lazy && !page.children ? { hasChildren: true } : {}),
    ...(page.children ? { children: pageNodes(page.children) } : {}),
  }));
}

function findPage(pages: ReadonlyArray<Page>, key: string): Page | undefined {
  for (const page of pages) {
    if (page.key === key) return page;
    const found = page.children ? findPage(page.children, key) : undefined;
    if (found) return found;
  }
  return undefined;
}

function updatePage(pages: ReadonlyArray<Page>, key: string, change: (page: Page) => Page): Page[] {
  return pages.map((page) => page.key === key ? change(page) : page.children ? { ...page, children: updatePage(page.children, key, change) } : page);
}

function movePage(pages: ReadonlyArray<Page>, details: CgTreeViewMoveDetails<Page>): Page[] {
  let moving: Page | undefined;
  const remove = (list: ReadonlyArray<Page>): Page[] => list
    .filter((page) => { if (page.key !== details.key) return true; moving = page; return false; })
    .map((page) => page.children ? { ...page, children: remove(page.children) } : page);
  const rest = remove(pages);
  const moved = moving;
  if (!moved) return [...pages];
  const insert = (list: ReadonlyArray<Page>, parentKey: string | null): Page[] => {
    const mapped = list.map((page) => page.children || page.key === details.parentKey ? { ...page, children: insert(page.children ?? [], page.key) } : page);
    if (parentKey === details.parentKey) mapped.splice(details.index, 0, moved);
    return mapped;
  };
  return insert(rest, null);
}

/** Pages go under a section or a page: never at the top, inside a database, inside a page only viewed, or inside one whose children are not loaded. */
function pageMayHold({ parentItem }: CgTreeViewDropCandidate<Page>): boolean {
  if (!parentItem) return false;
  return parentItem.kind !== 'database' && !parentItem.viewOnly && !(parentItem.lazy && !parentItem.children);
}

const actionButton = { display: 'inline-grid', placeItems: 'center', inlineSize: 24, blockSize: 24, padding: 0, border: 0, borderRadius: 4, background: 'transparent', color: 'var(--cg-text-secondary)', cursor: 'pointer' } as const;

function PageTreeExample({ initialExpanded }: { initialExpanded: ReadonlyArray<string> }) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(initialExpanded));
  const [action, setAction] = useState('none');
  const attempts = useRef(new Map<string, number>());
  const created = useRef(0);
  const actions = useRef<CgTreeViewActions>(null);
  const nodes = useMemo(() => pageNodes(pages), [pages]);
  const addInside = (parentKey: string) => {
    created.current += 1;
    const key = `new-${created.current}`;
    setPages((current) => updatePage(current, parentKey, (page) => ({ ...page, children: [...(page.children ?? []), { key, title: 'صفحة جديدة' }] })));
    setExpanded((current) => new Set(current).add(parentKey));
    setAction(`add:${parentKey}:${key}`);
  };
  return <StoryFrame source={pageTreeSource} difference={pageTreeDifference}>
    <div style={{ display: 'grid', gap: 8, inlineSize: 'min(20rem, 100%)' }}>
      <div style={{ padding: 4, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}>
        <CgTreeView<Page>
          nodes={nodes}
          actionsRef={actions}
          aria-label="الصفحات"
          data-testid="page-tree"
          arrowKeys="logical"
          size="small"
          textWrap={false}
          expandedKeys={expanded}
          onExpandedKeysChange={setExpanded}
          labels={{ expand: 'توسيع {0}', collapse: 'طي {0}', contextMenu: 'خيارات الصفحة', empty: 'لا صفحات' }}
          moveLabels={{
            instructions: 'اسحب، أو اضغط Alt وShift مع سهم، لنقل الصفحة',
            moved: (details) => `نُقلت «${details.item?.title ?? ''}»`,
          }}
          canDrop={pageMayHold}
          onNodeMove={(details) => {
            setPages((current) => movePage(current, details));
            setAction(`move:${details.key}:${details.position}:${details.targetKey}:${details.parentKey ?? 'root'}:${details.index}`);
          }}
          renameLabel="عنوان الصفحة"
          onNodeRename={({ key, text }) => {
            setPages((current) => updatePage(current, key, (page) => ({ ...page, title: text.trim() })));
            setAction(`rename:${key}:${text.trim()}`);
          }}
          loadLabels={{ loading: 'جارٍ تحميل الصفحات…', loadError: 'تعذّر تحميل الصفحات', retry: 'أعد المحاولة' }}
          loadChildren={({ key, signal }) => new Promise<void>((resolve, reject) => {
            setAction(`load:${key}:loading`);
            const timer = setTimeout(() => {
              const attempt = (attempts.current.get(key) ?? 0) + 1;
              attempts.current.set(key, attempt);
              if (findPage(pages, key)?.lazy === 'fail' && attempt === 1) {
                setAction(`load:${key}:error`);
                reject(new Error('offline'));
                return;
              }
              setPages((current) => updatePage(current, key, (page) => ({ ...page, children: LAZY_CHILDREN[key] ?? [] })));
              setAction(`load:${key}:loaded`);
              resolve();
            }, 700);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              setAction(`load:${key}:aborted`);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })}
          contextMenuAreas="node"
          customizeContextMenu={({ invocation }) => {
            const key = invocation.context.key;
            const page = key ? findPage(pages, key) : undefined;
            if (!key || !page) return [];
            const editable = page.kind !== 'section' && !page.viewOnly;
            return [
              { key: 'rename', text: 'إعادة التسمية', disabled: !editable, command: async () => { await actions.current?.startRename(key); } },
              { key: 'add', text: 'إضافة صفحة داخلها', disabled: page.kind === 'database' || Boolean(page.viewOnly), command: () => addInside(key) },
            ];
          }}
          renderActions={({ key, item, text }) => {
            const title = typeof text === 'string' ? text : key;
            return <>
              <button type="button" tabIndex={-1} style={actionButton} aria-label={`خيارات «${title}»`} title={`خيارات «${title}»`} aria-haspopup="menu" onClick={(event) => { void actions.current?.showContextMenu(key, event.currentTarget); }}><CgIcon name="more" /></button>
              {item?.kind !== 'database' && !item?.viewOnly ? <button type="button" tabIndex={-1} style={actionButton} aria-label={`إضافة صفحة داخل «${title}»`} title={`إضافة صفحة داخل «${title}»`} onClick={() => addInside(key)}><CgIcon name="add" /></button> : null}
            </>;
          }}
        />
      </div>
      <output data-testid="last-tree-action">{action}</output>
    </div>
  </StoryFrame>;
}

/** 50 sections of 99 pages: 5,000 nodes. */
function virtualPages(): Page[] {
  return Array.from({ length: 50 }, (_, section): Page => ({
    key: `s${section}`,
    title: `Section ${section + 1}`,
    kind: 'section',
    children: Array.from({ length: 99 }, (_, index) => ({ key: `s${section}-p${index}`, title: `Page ${section + 1}.${index + 1}` })),
  }));
}

function VirtualExample() {
  const [pages, setPages] = useState<Page[]>(virtualPages);
  const [action, setAction] = useState('none');
  const actions = useRef<CgTreeViewActions>(null);
  const nodes = useMemo(() => pageNodes(pages), [pages]);
  return <StoryFrame source={pageTreeSource} difference="Only the rows in view are drawn (fixed row height), with their level, position and set size; the focused row stays drawn when it scrolls away.">
    <div style={{ display: 'grid', gap: 8, inlineSize: 'min(24rem, 100%)' }}>
      <div style={{ padding: 4, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}>
        <CgTreeView<Page>
          nodes={nodes}
          actionsRef={actions}
          virtualize
          height={420}
          aria-label="Five thousand pages"
          data-testid="virtual-tree"
          defaultExpandedKeys={new Set(['s0', 's1'])}
          moveLabels={{ instructions: 'Drag, or press Alt+Shift with an arrow key, to move the page', moved: (details) => `${details.item?.title ?? ''} moved` }}
          canDrop={pageMayHold}
          onNodeMove={(details) => {
            setPages((current) => movePage(current, details));
            setAction(`move:${details.key}:${details.position}:${details.targetKey}:${details.parentKey ?? 'root'}:${details.index}`);
          }}
          renameLabel="Page title"
          onNodeRename={({ key, text }) => {
            setPages((current) => updatePage(current, key, (page) => ({ ...page, title: text.trim() })));
            setAction(`rename:${key}:${text.trim()}`);
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" data-testid="expand-all" onClick={() => { void actions.current?.expandAll(); }}>Expand all</button>
      </div>
      <output data-testid="last-tree-action">{action}</output>
    </div>
  </StoryFrame>;
}

export const PageTreeArabic: Story = { globals: { direction: 'rtl' }, render: () => <PageTreeExample initialExpanded={['workspace', 'start', 'private']} /> };
export const PageTreeDark: Story = { globals: { theme: 'dark', direction: 'rtl' }, render: () => <PageTreeExample initialExpanded={['workspace', 'projects', 'shared']} /> };
export const VirtualFiveThousand: Story = { render: () => <VirtualExample /> };
