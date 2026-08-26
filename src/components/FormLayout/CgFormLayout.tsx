import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement, RefAttributes } from 'react';
import { useCgId, useControllableState, useDirection, useMergedRefs } from '../../hooks';
import { CgFormLayoutCaptionContext, toCssLength } from '../../internal';
import { formLayoutSpanStyle } from '../../internal/formLayout';
import { cx } from '../../utils';
import { CgTabs } from '../Tabs';
import type { CgTabDescriptor } from '../Tabs';
import styles from './CgFormLayout.module.css';
import { CgFormLayoutContext, useCgFormLayoutContext } from './CgFormLayoutContext';
import type {
  CgFormLayoutGroupExpansionDetails, CgFormLayoutGroupProps, CgFormLayoutItemProps, CgFormLayoutProps,
  CgFormLayoutResponsiveProps, CgFormLayoutTabDescriptor, CgFormLayoutTabsProps,
} from './CgFormLayout.types';

function spanStyle(props: CgFormLayoutResponsiveProps, itemDefaults: boolean, style?: CSSProperties): CSSProperties {
  return { ...formLayoutSpanStyle(props, itemDefaults), ...style };
}

export const CgFormLayout = forwardRef<HTMLDivElement, CgFormLayoutProps>(function CgFormLayout(
  { children, captionPosition = 'vertical', captionWidth = '10rem', size = 'medium', direction = 'auto', className, style, ...nativeProps },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const resolvedCaptionWidth = toCssLength(captionWidth, '10rem');
  const context = useMemo(() => ({ captionPosition, captionWidth: resolvedCaptionWidth, size, direction: resolvedDirection }), [captionPosition, resolvedCaptionWidth, resolvedDirection, size]);
  return <CgFormLayoutContext.Provider value={context}>
    <div {...nativeProps} ref={mergedRef} dir={resolvedDirection} className={cx(styles.grid, styles.root, styles[size], className)} style={{ '--cg-fl-caption-width': resolvedCaptionWidth, ...style } as CSSProperties}>{children}</div>
  </CgFormLayoutContext.Provider>;
});

export const CgFormLayoutItem = forwardRef<HTMLDivElement, CgFormLayoutItemProps>(function CgFormLayoutItem(
  { caption, renderCaption, renderItem, captionPosition, captionFor, captionClassName, children, xs, sm, md, lg, xl, xxl, visible = true, beginRow = false, className, style, id, ...nativeProps },
  ref,
) {
  const inherited = useCgFormLayoutContext();
  const resolvedPosition = captionPosition ?? inherited.captionPosition;
  const itemId = useCgId(id);
  const hasCaption = caption !== undefined && caption !== null && caption !== '';
  const captionId = hasCaption ? `${itemId}-caption` : undefined;
  if (!visible) return null;
  const base = { caption: caption ?? null, content: children, captionPosition: resolvedPosition, ...(captionId ? { captionId } : {}), ...(captionFor ? { controlId: captionFor } : {}) };
  const renderedCaption = hasCaption ? renderCaption?.(base) ?? caption : null;
  const captionElement = renderedCaption === null ? null : captionFor
    ? <label id={captionId} htmlFor={captionFor} className={cx(styles.caption, captionClassName)}>{renderedCaption}</label>
    : <div id={captionId} className={cx(styles.caption, captionClassName)}>{renderedCaption}</div>;
  const content = <CgFormLayoutCaptionContext.Provider value={captionFor ? undefined : captionId}><div className={styles.control}>{children}</div></CgFormLayoutCaptionContext.Provider>;
  const inner = renderItem?.({ ...base, caption: captionElement, content }) ?? <div className={styles.itemInner}>{captionElement}{content}</div>;
  return <div {...nativeProps} id={itemId} ref={ref} data-caption-position={resolvedPosition} className={cx(styles.cell, styles.item, beginRow && styles.beginRow, className)} style={spanStyle({ xs, sm, md, lg, xl, xxl }, true, style)}>{inner}</div>;
});

export const CgFormLayoutGroup = forwardRef<HTMLDivElement, CgFormLayoutGroupProps>(function CgFormLayoutGroup(
  { caption, captionAriaLabel, renderCaption, children, collapsible = false, expanded, defaultExpanded = true, onExpandedChange, afterExpandedChange, xs, sm, md, lg, xl, xxl, visible = true, beginRow = false, className, style, id, ...nativeProps },
  ref,
) {
  const inherited = useCgFormLayoutContext();
  const groupId = useCgId(id);
  const contentId = `${groupId}-content`;
  const [actualExpanded, setActualExpanded] = useControllableState(expanded, collapsible ? defaultExpanded : true, 'CgFormLayoutGroup expanded');
  const shownExpanded = collapsible ? actualExpanded : true;
  const pending = useRef<CgFormLayoutGroupExpansionDetails | undefined>(undefined);
  const accessibleCaption = typeof caption === 'string' || typeof caption === 'number' ? String(caption).trim() : captionAriaLabel?.trim();
  if (collapsible && !accessibleCaption && (caption === undefined || caption === null || typeof caption === 'string' || typeof caption === 'number')) throw new Error('CgFormLayoutGroup collapsible groups require accessible caption content.');
  useEffect(() => {
    if (!pending.current || pending.current.expanded !== actualExpanded) return;
    const details = pending.current; pending.current = undefined; afterExpandedChange?.(details);
  }, [actualExpanded, afterExpandedChange]);
  if (!visible) return null;
  const request = () => {
    if (!collapsible) return;
    const next = !actualExpanded;
    const details: CgFormLayoutGroupExpansionDetails = { expanded: next, previousExpanded: actualExpanded, source: 'pointer', isUserInitiated: true };
    setActualExpanded(next); onExpandedChange?.(next, details);
    if (expanded === undefined) afterExpandedChange?.(details); else pending.current = details;
  };
  const renderContext = { caption: caption ?? null, expanded: shownExpanded, collapsible, contentId };
  const renderedCaption = renderCaption?.(renderContext) ?? caption;
  const heading = collapsible
    ? <button type="button" className={styles.groupToggle} aria-label={captionAriaLabel} aria-expanded={shownExpanded} aria-controls={contentId} onClick={request}>{renderedCaption}<span aria-hidden="true">{shownExpanded ? '−' : '+'}</span></button>
    : renderedCaption !== undefined && renderedCaption !== null ? <div role="heading" aria-level={2} className={styles.groupCaption}>{renderedCaption}</div> : null;
  return <section {...nativeProps} id={groupId} ref={ref} className={cx(styles.cell, styles.group, beginRow && styles.beginRow, className)} style={spanStyle({ xs, sm, md, lg, xl, xxl }, false, style)} dir={inherited.direction}>
    {heading}
    <div id={contentId} className={cx(styles.grid, styles.groupBody)} hidden={!shownExpanded}>{children}</div>
  </section>;
});

function CgFormLayoutTabsInner<TData>(
  { tabs, activeKey, defaultActiveKey, onActiveKeyChange, contentMode = 'on-demand', emptyContent, actionsRef, xs, sm, md, lg, xl, xxl, visible = true, beginRow = false, className, style, ...nativeProps }: CgFormLayoutTabsProps<TData>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const inherited = useCgFormLayoutContext();
  if (!visible) return null;
  const mapped = tabs.map((tab): CgTabDescriptor<TData> => ({
    ...tab,
    content: <CgFormLayoutContext.Provider value={{ ...inherited, captionPosition: tab.captionPosition ?? inherited.captionPosition }}><div className={cx(styles.grid, styles.tabGrid)}>{tab.content}</div></CgFormLayoutContext.Provider>,
  }));
  return <div {...nativeProps} ref={ref} className={cx(styles.cell, styles.tabs, beginRow && styles.beginRow, className)} style={spanStyle({ xs, sm, md, lg, xl, xxl }, false, style)}>
    <CgTabs tabs={mapped} activeKey={activeKey} defaultActiveKey={defaultActiveKey} onActiveKeyChange={onActiveKeyChange} contentMode={contentMode} emptyContent={emptyContent} actionsRef={actionsRef} size={inherited.size} direction={inherited.direction} />
  </div>;
}

export const CgFormLayoutTabs = forwardRef(CgFormLayoutTabsInner) as <TData = unknown>(props: CgFormLayoutTabsProps<TData> & RefAttributes<HTMLDivElement>) => ReactElement | null;
export type { CgFormLayoutTabDescriptor };
