import { forwardRef, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent, ForwardedRef, KeyboardEvent, MouseEvent, PointerEvent, ReactElement, RefAttributes } from 'react';
import { useCgId, useControllableState, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import { CgContextMenu } from '../ContextMenu';
import type { CgContextMenuActions, CgContextMenuItem } from '../ContextMenu';
import { CgDragHandle, CgDropIndicator, cgStartsDrag, cgTrackDrag } from '../DragDrop';
import type { CgDropIndicatorHandle } from '../DragDrop';
import { CgIcon } from '../Icon';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import styles from './CgKanbanBoard.module.css';
import type { CgKanbanBoardProps, CgKanbanCard, CgKanbanColumn } from './CgKanbanBoard.types';
import {
  groupKanbanCards,
  kanbanCardsInWindow,
  kanbanColumnLayout,
  kanbanDropGap,
  kanbanGapOf,
  kanbanKeyMove,
  kanbanMoveDrop,
  kanbanMoveFocus,
  kanbanNearestColumn,
  kanbanTargetIndex,
} from './kanbanLayout';
import type { KanbanColumnLayout, KanbanKeyMove, KanbanPosition } from './kanbanLayout';

/** The window's top is kept in steps of this many pixels, so a scroll draws again only now and then. */
const STEP = 160;
/** Pixels drawn above and below the window. */
const OVERSCAN = 480;
/** The window's height before the board is measured (and where nothing is laid out, as in tests). */
const FALLBACK_HEIGHT = 800;
const REVEAL_PAD = 8;
const NO_ITEMS: ReadonlyArray<CgContextMenuItem<string>> = [];
const NO_KEYS: readonly string[] = [];

interface ColumnModel<TData, TColumnData> {
  readonly column: CgKanbanColumn<TColumnData>;
  readonly cards: ReadonlyArray<CgKanbanCard<TData>>;
  readonly layout: KanbanColumnLayout;
}

/** Where a card would land: `toIndex` in the column at `col`; a `gap` of null marks the whole column. */
interface Drop {
  readonly col: number;
  readonly toIndex: number;
  readonly gap: number | null;
}

/** A card Space picked up: where it came from and where it would land (an index among the other cards). */
interface Picked {
  readonly key: string;
  readonly from: KanbanPosition;
  to: KanbanPosition;
}

/** A card to focus once it is drawn in `columnKey` (at `index`, when known). */
interface PendingFocus {
  readonly key: string;
  readonly columnKey: string;
  readonly index: number | null;
}

function required(value: unknown, name: string, reason: string): void {
  if (value === undefined || (typeof value === 'string' && !value.trim())) {
    throw new Error(`CgKanbanBoard labels.${name} is required ${reason}.`);
  }
}

function named(text: string, name: string): string {
  if (!text.trim()) throw new Error(`CgKanbanBoard labels.${name} cannot give an empty name.`);
  return text;
}

/** Keeps `value` in `map` under `key` while React keeps it, for a ref callback. */
function track<T>(map: Map<string, T>, key: string, value: T | null): (() => void) | undefined {
  if (value === null) return undefined;
  map.set(key, value);
  return () => {
    if (map.get(key) === value) map.delete(key);
  };
}

/** The copy that follows the pointer: the card's box without its identity, in the card's theme. */
function cardGhost(source: HTMLElement): HTMLElement {
  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  for (const element of [ghost, ...ghost.querySelectorAll('[id]')]) element.removeAttribute('id');
  for (const name of ['role', 'tabindex', 'aria-label', 'aria-describedby', 'aria-posinset', 'aria-setsize', 'data-cg-kanban-card', 'data-cg-picked']) {
    ghost.removeAttribute(name);
  }
  ghost.inert = true;
  ghost.style.removeProperty('inset-block-start');
  ghost.style.inlineSize = `${rect.width}px`;
  ghost.style.blockSize = `${rect.height}px`;
  // The copy is put in the body, outside the board's theme: it takes the card's along.
  const theme = source.closest('[data-cg-theme]')?.getAttribute('data-cg-theme');
  if (theme) ghost.setAttribute('data-cg-theme', theme);
  return ghost;
}

interface CardItemProps<TData, TColumnData> {
  card: CgKanbanCard<TData>;
  column: CgKanbanColumn<TColumnData>;
  index: number;
  setSize: number;
  top: number;
  size: number;
  tabbable: boolean;
  handleLabel: string | undefined;
  hintId: string | undefined;
  renderCard: CgKanbanBoardProps<TData, TColumnData>['renderCard'];
  register: (key: string, element: HTMLDivElement | null) => (() => void) | undefined;
  onHandleClick: (key: string, handle: HTMLElement) => void;
}

/**
 * One card's box: the focus, the name, the place and the handle. It has no handlers of its own
 * (the board listens on its scroller and finds the card by `data-cg-kanban-card`), so a card is
 * drawn again only when it, its place or the tab stop changes.
 */
function KanbanCardItemInner<TData, TColumnData>({
  card, column, index, setSize, top, size, tabbable, handleLabel, hintId, renderCard, register, onHandleClick,
}: CardItemProps<TData, TColumnData>) {
  return <div
    ref={(element) => register(card.key, element)}
    role="listitem"
    className={styles.card}
    tabIndex={tabbable ? 0 : -1}
    aria-label={card.label}
    aria-describedby={hintId}
    aria-posinset={index + 1}
    aria-setsize={setSize}
    data-cg-kanban-card={card.key}
    data-cg-kanban-column={column.key}
    data-fixed={card.fixed ? '' : undefined}
    style={{ insetBlockStart: top, blockSize: size }}
  >
    <div className={cx(styles.content, handleLabel !== undefined && styles.withHandle)}>
      {renderCard(card, Object.freeze({ index, column }))}
    </div>
    {handleLabel !== undefined ? <CgDragHandle
      className={styles.handle}
      label={handleLabel}
      tabIndex={-1}
      aria-haspopup="menu"
      data-cg-kanban-grip=""
      onClick={(event) => onHandleClick(card.key, event.currentTarget)}
    /> : null}
  </div>;
}

const KanbanCardItem = memo(KanbanCardItemInner) as typeof KanbanCardItemInner;

/**
 * Columns of cards, each card drawn by `renderCard`. A card moves by pointer (a copy follows the
 * pointer and one line shows where it lands; no card is drawn again during the drag), by keys
 * (Space picks it up, the arrows move it, Space or Enter drops it, Escape cancels), or from its
 * handle's menu; the board tells `onCardMove` and never reorders its own data. The board scrolls
 * as one with sticky headers, and each column draws only the cards in view.
 */
function CgKanbanBoardInner<TData, TColumnData>(
  {
    columns,
    cards,
    renderCard,
    labels,
    onCardMove,
    canMove,
    onCardOpen,
    onAddCard,
    cardMenuItems,
    fixedOrder = false,
    cardSize = 72,
    cardGap = 8,
    columnSize,
    collapsible = false,
    collapsedColumns,
    defaultCollapsedColumns,
    onCollapsedColumnsChange,
    onShowColumn,
    renderColumnActions,
    locale,
    className,
    style,
    ...nativeProps
  }: CgKanbanBoardProps<TData, TColumnData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!labels.board.trim()) throw new Error('CgKanbanBoard labels.board cannot be empty.');
  if (!labels.emptyColumn.trim()) throw new Error('CgKanbanBoard labels.emptyColumn cannot be empty.');
  if (!Number.isFinite(cardSize) || cardSize <= 0) throw new RangeError('CgKanbanBoard cardSize must be a positive number of pixels.');
  if (!Number.isFinite(cardGap) || cardGap < 0) throw new RangeError('CgKanbanBoard cardGap cannot be negative.');
  const movable = onCardMove !== undefined;
  if (movable) {
    const reason = 'when cards can move (onCardMove)';
    required(labels.cardHint, 'cardHint', reason);
    required(labels.cardHandle, 'cardHandle', reason);
    required(labels.pickedUp, 'pickedUp', reason);
    required(labels.position, 'position', reason);
    required(labels.moved, 'moved', reason);
    required(labels.cancelled, 'cancelled', reason);
    required(labels.moveToColumn, 'moveToColumn', reason);
    if (!fixedOrder) {
      required(labels.moveUp, 'moveUp', `${reason}, unless fixedOrder`);
      required(labels.moveDown, 'moveDown', `${reason}, unless fixedOrder`);
    }
  }
  if (onAddCard) required(labels.addCard, 'addCard', 'with onAddCard');
  if (collapsible) {
    required(labels.collapseColumn, 'collapseColumn', 'with collapsible');
    required(labels.expandColumn, 'expandColumn', 'with collapsible');
  }
  if (onShowColumn) {
    required(labels.hiddenColumns, 'hiddenColumns', 'with onShowColumn');
    required(labels.showColumn, 'showColumn', 'with onShowColumn');
  }

  const hintId = useCgId();
  const hint = labels.cardHint?.trim() ? labels.cardHint : undefined;
  const counter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const models = useMemo<Array<ColumnModel<TData, TColumnData>>>(() => {
    const grouped = groupKanbanCards(columns, cards);
    return columns.filter((column) => !column.hidden).map((column) => {
      const list = grouped.get(column.key) ?? [];
      const sizes = list.map((card) => {
        if (!card.label.trim()) throw new Error(`CgKanbanBoard card '${card.key}' needs a label.`);
        const size = card.size ?? cardSize;
        if (!Number.isFinite(size) || size <= 0) throw new RangeError(`CgKanbanBoard card '${card.key}' size must be a positive number of pixels.`);
        return size;
      });
      return { column, cards: list, layout: kanbanColumnLayout(sizes, cardGap) };
    });
  }, [columns, cards, cardSize, cardGap]);
  const positions = useMemo(() => {
    const map = new Map<string, KanbanPosition>();
    models.forEach((model, col) => model.cards.forEach((card, index) => map.set(card.key, { col, index })));
    return map;
  }, [models]);
  const hiddenColumns = useMemo(() => columns.filter((column) => column.hidden), [columns]);

  const [collapsedKeys, setCollapsedKeys] = useControllableState(collapsedColumns, defaultCollapsedColumns ?? NO_KEYS, 'CgKanbanBoard');
  const collapsed = useMemo(() => new Set(collapsible ? collapsedKeys : NO_KEYS), [collapsible, collapsedKeys]);

  const [view, setView] = useState({ top: 0, height: FALLBACK_HEIGHT, offset: 0 });
  const [activeKey, setActiveKey] = useState<string>();
  const [menuKey, setMenuKey] = useState<string>();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const bodies = useRef(new Map<string, HTMLDivElement>());
  const indicators = useRef(new Map<string, CgDropIndicatorHandle>());
  const cardElements = useRef(new Map<string, HTMLDivElement>());
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const menu = useRef<CgContextMenuActions<string>>(null);
  const picked = useRef<Picked | null>(null);
  const shownDrop = useRef<{ columnKey: string; whole: boolean } | null>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);

  const cardOf = (key: string): CgKanbanCard<TData> | undefined => {
    const position = positions.get(key);
    return position ? models[position.col]?.cards[position.index] : undefined;
  };
  const allowed = (cardKey: string, columnKey: string, toIndex: number) => !canMove || canMove(cardKey, columnKey, toIndex);
  /** A collapsed column, or any with `fixedOrder`, takes a drop as a whole, at its end. */
  const whole = (col: number) => fixedOrder || collapsed.has(models[col]?.column.key ?? '');

  // ---- The window ----------------------------------------------------------------------------
  const measure = useStableCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = Math.floor(scroller.scrollTop / STEP) * STEP;
    const height = scroller.clientHeight || FALLBACK_HEIGHT;
    const body = bodies.current.values().next().value;
    const offset = body ? Math.max(0, Math.round(body.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop)) : 0;
    setView((current) => (current.top === top && current.height === height && current.offset === offset ? current : { top, height, offset }));
  });
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return undefined;
    // Observing calls back once at the start, which measures the board.
    const observer = new ResizeObserver(() => measure());
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [measure]);
  const windowTop = view.top - view.offset - OVERSCAN;
  const windowBottom = view.top - view.offset + view.height + OVERSCAN + STEP;

  // ---- Scrolling into view and focus ---------------------------------------------------------
  /** Scrolls the column at `col` into view along the row and, given a range of its body, that range down the board. */
  const revealRange = (col: number, start?: number, end?: number) => {
    const scroller = scrollerRef.current;
    const model = models[col];
    const section = model ? sections.current.get(model.column.key) : undefined;
    if (!scroller || !model || !section) return;
    // Viewport pixels are physical, in either direction.
    const port = scroller.getBoundingClientRect();
    const box = section.getBoundingClientRect();
    let left = 0;
    let top = 0;
    if (box.left < port.left) left = box.left - port.left - REVEAL_PAD;
    else if (box.right > port.right) left = Math.min(box.right - port.right + REVEAL_PAD, box.left - port.left - REVEAL_PAD);
    const body = bodies.current.get(model.column.key);
    if (body && start !== undefined && end !== undefined) {
      const head = section.firstElementChild instanceof HTMLElement ? section.firstElementChild.offsetHeight : 0;
      const origin = body.getBoundingClientRect().top;
      if (origin + start < port.top + head) top = origin + start - port.top - head - REVEAL_PAD;
      else if (origin + end > port.bottom) top = origin + end - port.bottom + REVEAL_PAD;
    }
    if (left || top) scroller.scrollBy?.({ left, top });
  };
  const revealCard = (position: KanbanPosition) => {
    const layout = models[position.col]?.layout;
    if (!layout) return;
    revealRange(position.col, layout.offsets[position.index], (layout.offsets[position.index + 1] ?? layout.total) - layout.gap);
  };

  /** Focuses the card a move or a key asked for, once it is drawn where it was sent, unless the focus has gone elsewhere. */
  const applyPendingFocus = useStableCallback(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const position = positions.get(pending.key);
    const element = cardElements.current.get(pending.key);
    if (!position || !element || models[position.col]?.column.key !== pending.columnKey) return;
    if (pending.index !== null && pending.index !== position.index) return;
    const active = element.ownerDocument.activeElement;
    if (active && active !== element.ownerDocument.body && active !== element && !scrollerRef.current?.contains(active)) return;
    pendingFocus.current = null;
    if (active !== element) element.focus({ preventScroll: true });
    revealCard(position);
  });
  useLayoutEffect(() => applyPendingFocus());

  // ---- The drop line ---------------------------------------------------------------------------
  const hideDrop = useStableCallback(() => {
    const current = shownDrop.current;
    shownDrop.current = null;
    if (!current) return;
    if (current.whole) sections.current.get(current.columnKey)?.removeAttribute('data-cg-drop-target');
    else indicators.current.get(current.columnKey)?.hide();
  });
  /** Moves the line (or the whole-column mark) to a drop: the DOM is written directly, React draws nothing. */
  const showDrop = useStableCallback((drop: Drop | null) => {
    const model = drop ? models[drop.col] : undefined;
    const columnKey = model?.column.key;
    const current = shownDrop.current;
    if (current && (!drop || current.columnKey !== columnKey || current.whole !== (drop.gap === null))) hideDrop();
    if (!drop || !model || columnKey === undefined) return;
    if (drop.gap === null) {
      sections.current.get(columnKey)?.setAttribute('data-cg-drop-target', '');
    } else {
      const block = Math.max(0, (model.layout.offsets[drop.gap] ?? model.layout.total) - model.layout.gap / 2);
      indicators.current.get(columnKey)?.show({ block, inline: 0, length: bodies.current.get(columnKey)?.clientWidth ?? 0 });
    }
    shownDrop.current = { columnKey, whole: drop.gap === null };
  });
  useEffect(() => () => stopDrag.current?.(), []);

  // ---- Moving ----------------------------------------------------------------------------------
  /** Tells the caller of a move and says it. False when it is no move or is vetoed. */
  const commit = useStableCallback((cardKey: string, drop: Drop, source: 'pointer' | 'keyboard'): boolean => {
    const from = positions.get(cardKey);
    const origin = from ? models[from.col] : undefined;
    const target = models[drop.col];
    const card = from ? origin?.cards[from.index] : undefined;
    if (!onCardMove || !from || !origin || !target || !card) return false;
    if (drop.col === from.col && drop.toIndex === from.index) return false;
    if (!allowed(cardKey, target.column.key, drop.toIndex)) return false;
    const same = drop.col === from.col;
    // The focus follows the card to its new place once the caller draws it there.
    pendingFocus.current = { key: cardKey, columnKey: target.column.key, index: same && !fixedOrder ? drop.toIndex : null };
    setActiveKey(cardKey);
    onCardMove(cardKey, target.column.key, drop.toIndex, Object.freeze({ fromColumnKey: origin.column.key, fromIndex: from.index, source }));
    live.current?.announce(labels.moved?.(card, target.column, drop.toIndex, target.cards.length + (same ? 0 : 1)) ?? '');
    return true;
  });

  /** A pointer drop at `y` (the column body's coordinates) in the column at `col`. */
  const pointerDrop = useStableCallback((cardKey: string, col: number, y: number): Drop | null => {
    const from = positions.get(cardKey);
    const model = models[col];
    if (!from || !model) return null;
    const same = col === from.col;
    if (whole(col)) {
      const toIndex = model.cards.length;
      return same || !allowed(cardKey, model.column.key, toIndex) ? null : { col, toIndex, gap: null };
    }
    const gap = kanbanDropGap(model.layout, y);
    const toIndex = same ? kanbanTargetIndex(from.index, gap) : gap;
    if (toIndex === null || !allowed(cardKey, model.column.key, toIndex)) return null;
    return { col, toIndex, gap };
  });

  const measureColumns = useStableCallback(() => models.map((model) => {
    const box = sections.current.get(model.column.key)?.getBoundingClientRect();
    const body = bodies.current.get(model.column.key)?.getBoundingClientRect();
    return { left: box?.left ?? 0, right: box?.right ?? 0, top: body?.top ?? box?.top ?? 0 };
  }));

  const beginDrag = (press: globalThis.PointerEvent, element: HTMLElement, cardKey: string) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let geometry: Array<{ left: number; right: number; top: number }> = [];
    let start = { left: 0, top: 0 };
    let drop: Drop | null = null;
    const locate = (x: number, y: number): Drop | null => {
      const dx = scroller.scrollLeft - start.left;
      const dy = scroller.scrollTop - start.top;
      const col = kanbanNearestColumn(geometry.map((box) => ({ left: box.left - dx, right: box.right - dx })), x);
      const box = geometry[col];
      return box ? pointerDrop(cardKey, col, y - (box.top - dy)) : null;
    };
    stopDrag.current?.();
    stopDrag.current = cgTrackDrag(press, element, {
      scroller,
      ghost: cardGhost,
      ...(styles.ghost ? { ghostClassName: styles.ghost } : {}),
      onStart() {
        // The card stays drawn while it is dragged, wherever the board scrolls.
        setActiveKey(cardKey);
        start = { left: scroller.scrollLeft, top: scroller.scrollTop };
        geometry = measureColumns();
      },
      onMove(x, y) {
        drop = locate(x, y);
        showDrop(drop);
      },
      onDrop(x, y) {
        hideDrop();
        stopDrag.current = null;
        // Where the pointer was let go, not where the last frame saw it: a release can come
        // before the frame that would have followed the last move.
        drop = locate(x, y);
        if (drop) commit(cardKey, drop, 'pointer');
      },
      onCancel() {
        hideDrop();
        stopDrag.current = null;
      },
    });
  };

  // ---- Keyboard pick-up --------------------------------------------------------------------------
  /** Where a picked-up card lands: null where it already is. */
  const pickedDrop = (p: Picked): Drop | null => {
    const model = models[p.to.col];
    if (!model) return null;
    const same = p.to.col === p.from.col;
    if (whole(p.to.col)) return same ? null : { col: p.to.col, toIndex: model.cards.length, gap: null };
    if (same && p.to.index === p.from.index) return null;
    return { col: p.to.col, toIndex: p.to.index, gap: same ? kanbanGapOf(p.from.index, p.to.index) : p.to.index };
  };
  /** The next place a key takes a picked-up card to, past places `canMove` refuses. */
  const nextPlace = (p: Picked, move: KanbanKeyMove): KanbanPosition | null => {
    const counts = models.map((model, col) => (whole(col) ? 0 : model.cards.length - (col === p.from.col ? 1 : 0)));
    let place: KanbanPosition | null = p.to;
    for (;;) {
      place = kanbanMoveDrop(counts, place, move);
      if (!place) return null;
      const drop = pickedDrop({ ...p, to: place });
      if (!drop || allowed(p.key, models[drop.col]?.column.key ?? '', drop.toIndex)) return place;
    }
  };
  const showPicked = (p: Picked) => {
    const model = models[p.to.col];
    const card = cardOf(p.key);
    if (!model || !card) return;
    const drop = pickedDrop(p);
    showDrop(drop);
    const same = p.to.col === p.from.col;
    live.current?.announce(labels.position?.(card, model.column, drop ? drop.toIndex : p.from.index, model.cards.length + (same ? 0 : 1)) ?? '');
    if (!drop) revealCard(p.from);
    else if (drop.gap === null) revealRange(drop.col);
    else {
      const y = model.layout.offsets[drop.gap] ?? model.layout.total;
      revealRange(drop.col, y - cardSize / 2, y + cardSize / 2);
    }
  };
  const pickUp = (position: KanbanPosition, element: HTMLElement) => {
    const model = models[position.col];
    const card = model?.cards[position.index];
    if (!model || !card) return;
    pendingFocus.current = null;
    picked.current = { key: card.key, from: position, to: position };
    element.setAttribute('data-cg-picked', '');
    live.current?.announce(labels.pickedUp?.(card, model.column, position.index, model.cards.length) ?? '');
  };
  const endPick = (drop: boolean) => {
    const current = picked.current;
    picked.current = null;
    hideDrop();
    if (!current) return;
    cardElements.current.get(current.key)?.removeAttribute('data-cg-picked');
    const target = drop ? pickedDrop(current) : null;
    if (target && commit(current.key, target, 'keyboard')) return;
    const card = cardOf(current.key);
    if (card) live.current?.announce(labels.cancelled?.(card) ?? '');
  };

  // ---- The card menu -------------------------------------------------------------------------------
  const menuItemsFor = useStableCallback((cardKey: string): Array<CgContextMenuItem<string>> => {
    const from = positions.get(cardKey);
    const origin = from ? models[from.col] : undefined;
    const card = from ? origin?.cards[from.index] : undefined;
    if (!from || !origin || !card) return [];
    const items: Array<CgContextMenuItem<string>> = [];
    if (movable && !card.fixed) {
      const moveTo = (drop: Drop): CgContextMenuItem<string>['command'] => ({ source }) => { commit(cardKey, drop, source); };
      if (!fixedOrder) {
        const up = from.index - 1;
        const down = from.index + 1;
        items.push({
          key: 'cg-kanban-move-up',
          text: labels.moveUp ?? '',
          disabled: up < 0 || !allowed(cardKey, origin.column.key, up),
          command: moveTo({ col: from.col, toIndex: up, gap: kanbanGapOf(from.index, up) }),
        });
        items.push({
          key: 'cg-kanban-move-down',
          text: labels.moveDown ?? '',
          disabled: down >= origin.cards.length || !allowed(cardKey, origin.column.key, down),
          command: moveTo({ col: from.col, toIndex: down, gap: kanbanGapOf(from.index, down) }),
        });
      }
      models.forEach((model, col) => {
        if (col === from.col) return;
        const toIndex = model.cards.length;
        items.push({
          key: `cg-kanban-move-to-${model.column.key}`,
          text: labels.moveToColumn?.(model.column) ?? '',
          disabled: !allowed(cardKey, model.column.key, toIndex),
          command: moveTo({ col, toIndex, gap: null }),
        });
      });
    }
    (cardMenuItems?.(card) ?? NO_ITEMS).forEach((item, index) => items.push(index === 0 && items.length > 0 ? { ...item, beginGroup: true } : item));
    return items;
  });
  /** Opens a card's menu by `anchor`; false when the card has no items. */
  const openMenu = useStableCallback((cardKey: string, anchor: HTMLElement): boolean => {
    if (!menuItemsFor(cardKey).length) return false;
    // The menu gives the focus back to the card, not to its handle.
    cardElements.current.get(cardKey)?.focus({ preventScroll: true });
    setMenuKey(cardKey);
    void menu.current?.showNear(anchor, cardKey);
    return true;
  });
  // Stable: the menu drops an opening invocation when these change.
  const customizeMenu = useCallback(({ invocation }: { invocation: { context: string } }) => menuItemsFor(invocation.context), [menuItemsFor]);
  // A move draws the card elsewhere: once the menu has given the focus back, it follows the card.
  const afterMenuClose = useCallback(() => { requestAnimationFrame(() => applyPendingFocus()); }, [applyPendingFocus]);
  const registerCard = useCallback((key: string, element: HTMLDivElement | null) => track(cardElements.current, key, element), []);

  // ---- Events (on the scroller, found by data attributes) -------------------------------------------
  const cardFrom = (target: EventTarget | null, scroller: HTMLElement): HTMLElement | null => {
    const element = target instanceof Element ? target.closest<HTMLElement>('[data-cg-kanban-card]') : null;
    return element && scroller.contains(element) ? element : null;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !movable) return;
    if (picked.current) {
      endPick(false);
      return;
    }
    const element = cardFrom(event.target, event.currentTarget);
    if (!element || !(event.target instanceof Element)) return;
    const onHandle = event.target.closest('[data-cg-kanban-grip]') !== null;
    if (!onHandle && !cgStartsDrag(event.target, element)) return;
    const cardKey = element.dataset.cgKanbanCard ?? '';
    const card = cardOf(cardKey);
    if (!card || card.fixed) return;
    beginDrag(event.nativeEvent, element, cardKey);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.cgKanbanCard === undefined) return;
    const cardKey = target.dataset.cgKanbanCard;
    const position = positions.get(cardKey);
    const card = cardOf(cardKey);
    if (!position || !card) return;
    const rtl = getComputedStyle(target).direction === 'rtl';
    const current = picked.current;
    if (current) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape' || event.key === 'Tab') return endPick(false);
      if (event.key === ' ' || event.key === 'Enter') return endPick(true);
      const move = kanbanKeyMove(event.key, rtl);
      const place = move ? nextPlace(current, move) : null;
      if (!place) return;
      current.to = place;
      showPicked(current);
      return;
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      if (openMenu(cardKey, target)) event.preventDefault();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter') {
      if (!onCardOpen) return;
      event.preventDefault();
      onCardOpen(cardKey, Object.freeze({ source: 'keyboard' }));
      return;
    }
    if (event.key === ' ') {
      if (!movable || card.fixed) return;
      event.preventDefault();
      pickUp(position, target);
      return;
    }
    const move = kanbanKeyMove(event.key, rtl);
    if (!move) return;
    event.preventDefault();
    const counts = models.map((model) => (collapsed.has(model.column.key) ? 0 : model.cards.length));
    const next = kanbanMoveFocus(counts, position, move);
    const nextModel = next ? models[next.col] : undefined;
    const nextCard = next ? nextModel?.cards[next.index] : undefined;
    if (!next || !nextModel || !nextCard) return;
    pendingFocus.current = { key: nextCard.key, columnKey: nextModel.column.key, index: next.index };
    setActiveKey(nextCard.key);
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const key = cardFrom(event.target, event.currentTarget)?.dataset.cgKanbanCard;
    if (key === undefined) return;
    if (pendingFocus.current && pendingFocus.current.key !== key) pendingFocus.current = null;
    if (key !== activeKey) setActiveKey(key);
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (next && event.currentTarget.contains(next)) return;
    if (picked.current) endPick(false);
    // The focus went elsewhere (not to the card menu): a card waiting for it does not take it back.
    if (next && !next.closest('[data-cg-overlay-portal]')) pendingFocus.current = null;
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onCardOpen || !(event.target instanceof Element)) return;
    const element = cardFrom(event.target, event.currentTarget);
    if (!element || !cgStartsDrag(event.target, element)) return;
    onCardOpen(element.dataset.cgKanbanCard ?? '', Object.freeze({ source: 'pointer' }));
  };
  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const element = cardFrom(event.target, event.currentTarget);
    if (!element) return;
    if (!event.target.closest('[data-cg-kanban-grip]') && !cgStartsDrag(event.target, element)) return;
    const cardKey = element.dataset.cgKanbanCard ?? '';
    if (!menuItemsFor(cardKey).length) return;
    element.focus({ preventScroll: true });
    setMenuKey(cardKey);
    void menu.current?.showFromEvent(event, cardKey);
  };

  const toggleColumn = (key: string) => {
    const next = collapsed.has(key) ? collapsedKeys.filter((entry) => entry !== key) : [...collapsedKeys, key];
    setCollapsedKeys(next);
    onCollapsedColumnsChange?.(next);
  };

  // ---- Drawing ---------------------------------------------------------------------------------------
  const activePosition = activeKey === undefined ? undefined : positions.get(activeKey);
  const tabKey = activePosition && !collapsed.has(models[activePosition.col]?.column.key ?? '')
    ? activeKey
    : models.find((model) => !collapsed.has(model.column.key) && model.cards.length > 0)?.cards[0]?.key;
  const tabPosition = tabKey === undefined ? undefined : positions.get(tabKey);
  const menuCard = menuKey === undefined ? undefined : cardOf(menuKey);
  const menuName = menuCard ? labels.cardHandle?.(menuCard) ?? menuCard.label : labels.board;

  const renderColumn = (model: ColumnModel<TData, TColumnData>, col: number) => {
    const { column, layout } = model;
    const isCollapsed = collapsed.has(column.key);
    const count = column.count ?? model.cards.length;
    const drawn: number[] = [];
    if (!isCollapsed) {
      const range = kanbanCardsInWindow(layout, windowTop, windowBottom);
      for (let index = range.start; index < range.end; index += 1) drawn.push(index);
      // The tab stop is always drawn, so Tab finds it wherever the board is scrolled.
      if (tabPosition?.col === col && (tabPosition.index < range.start || tabPosition.index >= range.end)) {
        drawn.push(tabPosition.index);
        drawn.sort((a, b) => a - b);
      }
    }
    const toggleName = collapsible ? named((isCollapsed ? labels.expandColumn : labels.collapseColumn)?.(column) ?? '', isCollapsed ? 'expandColumn' : 'collapseColumn') : '';
    const addName = onAddCard && !isCollapsed ? named(labels.addCard?.(column) ?? '', 'addCard') : '';
    return <section
      key={column.key}
      ref={(element) => track(sections.current, column.key, element)}
      className={cx(styles.column, isCollapsed && styles.collapsed)}
      aria-label={named(labels.column(column, count), 'column')}
      data-cg-kanban-column={column.key}
      data-collapsed={isCollapsed ? '' : undefined}
    >
      <div className={styles.head}>
        {collapsible ? <button
          type="button"
          className={styles.iconButton}
          aria-expanded={!isCollapsed}
          aria-label={toggleName}
          title={toggleName}
          onClick={() => toggleColumn(column.key)}
        ><CgIcon name={isCollapsed ? 'chevron-end' : 'chevron-down'} /></button> : null}
        {column.icon !== undefined ? <span className={styles.columnIcon} aria-hidden="true">{column.icon}</span> : null}
        <span className={styles.title} dir="auto" title={column.title}>{column.title}</span>
        <span className={styles.count} aria-hidden="true">{counter.format(count)}</span>
        {!isCollapsed && renderColumnActions ? <span className={styles.actions}>{renderColumnActions(column)}</span> : null}
        {addName ? <button
          type="button"
          className={styles.iconButton}
          aria-label={addName}
          title={addName}
          onClick={() => onAddCard?.(column.key)}
        ><CgIcon name="add" /></button> : null}
      </div>
      {isCollapsed ? null : <div
        ref={(element) => track(bodies.current, column.key, element)}
        className={styles.body}
        style={{ blockSize: layout.total }}
      >
        {model.cards.length > 0 ? <div role="list" className={styles.list}>
          {drawn.map((index) => {
            const card = model.cards[index]!;
            const handleLabel = movable && !card.fixed ? named(labels.cardHandle?.(card) ?? '', 'cardHandle') : undefined;
            return <KanbanCardItem<TData, TColumnData>
              key={card.key}
              card={card}
              column={column}
              index={index}
              setSize={model.cards.length}
              top={layout.offsets[index]!}
              size={layout.offsets[index + 1]! - layout.offsets[index]! - layout.gap}
              tabbable={card.key === tabKey}
              handleLabel={handleLabel}
              hintId={hint ? hintId : undefined}
              renderCard={renderCard}
              register={registerCard}
              onHandleClick={openMenu}
            />;
          })}
        </div> : <p className={styles.empty}>{labels.emptyColumn}</p>}
        <CgDropIndicator ref={(handle) => track(indicators.current, column.key, handle)} />
      </div>}
    </section>;
  };

  const rootStyle = columnSize === undefined
    ? style
    : { ...style, '--cg-kanban-column-size': typeof columnSize === 'number' ? `${columnSize}px` : columnSize } as CSSProperties;

  return <div {...nativeProps} ref={forwardedRef} className={cx(styles.root, className)} style={rootStyle} data-cg-kanban-board="">
    <div
      ref={scrollerRef}
      className={styles.scroller}
      role="region"
      aria-label={labels.board}
      onScroll={measure}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className={styles.columns}>
        {models.map(renderColumn)}
        {onShowColumn && hiddenColumns.length > 0 ? <section className={cx(styles.column, styles.hiddenList)} aria-label={labels.hiddenColumns}>
          <div className={styles.head}><span className={styles.title}>{labels.hiddenColumns}</span></div>
          <ul className={styles.hiddenItems}>
            {hiddenColumns.map((column) => {
              const name = named(labels.showColumn?.(column) ?? '', 'showColumn');
              return <li key={column.key} className={styles.hiddenItem}>
                {column.icon !== undefined ? <span className={styles.columnIcon} aria-hidden="true">{column.icon}</span> : null}
                <span className={styles.title} dir="auto">{column.title}</span>
                <button type="button" className={styles.iconButton} aria-label={name} title={name} onClick={() => onShowColumn(column.key)}>
                  <CgIcon name="eye" />
                </button>
              </li>;
            })}
          </ul>
        </section> : null}
      </div>
    </div>
    {hint ? <span id={hintId} hidden>{hint}</span> : null}
    <CgLiveAnnouncer ref={live} />
    <CgContextMenu<string>
      items={NO_ITEMS}
      actionsRef={menu}
      ariaLabel={menuName}
      loadingContent={null}
      customizeMenu={customizeMenu}
      afterClose={afterMenuClose}
    />
  </div>;
}

export const CgKanbanBoard = forwardRef(CgKanbanBoardInner) as <TData = unknown, TColumnData = unknown>(
  props: CgKanbanBoardProps<TData, TColumnData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
