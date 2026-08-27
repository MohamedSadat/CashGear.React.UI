import {
  useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import {
  CG_FILTER_OPERATOR_REGISTRY, CG_FILTER_PERIODS, CgFilterFieldRegistry, areFiltersEquivalent,
  createFilterValue, filterOperatorsForField, normalizeFilterNode,
} from '../../filter';
import type { CgFilterAggregate, CgFilterOperator, CgFilterValue } from '../../filter';
import { CgButton } from '../Button';
import { CgDateEdit } from '../DateEdit';
import { CgKeyComboBox } from '../KeyComboBox';
import { CgNumericEdit } from '../NumericEdit';
import { CgTagBox } from '../TagBox';
import { CgTextBox } from '../TextBox';
import styles from './CgFilterBuilder.module.css';
import type {
  CgFilterBuilderActions, CgFilterBuilderApplyDetails, CgFilterBuilderApplyReason,
  CgFilterBuilderEditorContext, CgFilterBuilderFieldDescriptor, CgFilterBuilderLabels,
  CgFilterBuilderProps,
} from './CgFilterBuilder.types';
import {
  createEditableRoot, duplicateEditable, editChildren, emptyAggregate, emptyCondition,
  moveEditable, projectEditable, removeEditable, setEditableField, setEditableOperator, updateEditable,
} from './model';
import type { EditableAggregate, EditableCondition, EditableGroup, EditableNode } from './model';

const DEFAULT_LABELS: CgFilterBuilderLabels = Object.freeze({
  builder: 'Filter builder', group: 'Filter group', field: 'Field', operator: 'Comparison', value: 'Value',
  secondValue: 'Second value', addCondition: 'Add condition', addGroup: 'Add group', addAggregate: 'Add collection condition',
  duplicate: 'Duplicate', remove: 'Remove', moveUp: 'Move up', moveDown: 'Move down', negate: 'Negate group',
  collapse: 'Collapse group', expand: 'Expand group', apply: 'Apply', cancel: 'Cancel', clear: 'Clear', reset: 'Reset', applying: 'Applying…',
});

const PERIOD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', thisWeek: 'This week', lastWeek: 'Last week', nextWeek: 'Next week',
  thisMonth: 'This month', lastMonth: 'Last month', nextMonth: 'Next month', thisQuarter: 'This quarter', lastQuarter: 'Last quarter',
  nextQuarter: 'Next quarter', thisYear: 'This year', lastYear: 'Last year', nextYear: 'Next year', yearToDate: 'Year to date',
  monthToDate: 'Month to date', beforeThisYear: 'Before this year', afterThisYear: 'After this year',
});

const AGGREGATES: ReadonlyArray<CgFilterAggregate> = ['exists', 'count', 'sum', 'average', 'minimum', 'maximum'];
let filterBuilderNodeSequence = 0;

function valueKind(field: CgFilterBuilderFieldDescriptor): CgFilterValue['kind'] {
  if (field.kind === 'enumeration') return field.options?.[0]?.value.kind ?? 'text';
  if (field.kind === 'collection') return 'number';
  return field.kind;
}

function joinClass(...values: Array<string | undefined | false>): string | undefined {
  const result = values.filter((value): value is string => Boolean(value));
  return result.length ? result.join(' ') : undefined;
}

export function CgFilterBuilder<TItem>({
  fields: fieldDescriptors,
  criteria,
  defaultCriteria = null,
  onCriteriaChange,
  onApply,
  onApplyError,
  onValidationChange,
  applyMode = 'explicit',
  debounceMs = 350,
  evaluationContext,
  isFieldAuthorized,
  renderEditor,
  renderDisplay,
  disabled = false,
  readOnly = false,
  size = 'medium',
  direction = 'auto',
  labels: labelOverrides,
  actionsRef,
  className,
  style,
  'data-testid': testId,
}: CgFilterBuilderProps<TItem>) {
  if (!Number.isFinite(debounceMs) || debounceMs < 0) throw new Error('CgFilterBuilder debounceMs must be zero or greater.');
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelOverrides }), [labelOverrides]);
  const registry = useMemo(() => new CgFilterFieldRegistry(fieldDescriptors), [fieldDescriptors]);
  const visibleFields = useMemo(() => registry.all.filter((field) => field.visible !== false && (!isFieldAuthorized || isFieldAuthorized(field))), [isFieldAuthorized, registry]);
  const scalarFields = useMemo(() => visibleFields.filter((field) => field.kind !== 'collection'), [visibleFields]);
  const collectionFields = useMemo(() => visibleFields.filter((field) => field.kind === 'collection'), [visibleFields]);
  const reactId = useId().replace(/:/gu, '');
  const nextId = useCallback(() => `${reactId}-filter-${++filterBuilderNodeSequence}`, [reactId]);
  const controlled = criteria !== undefined;
  const [committed, setCommitted] = useState(() => normalizeFilterNode(controlled ? criteria : defaultCriteria));
  const [root, setRoot] = useState(() => {
    let initialSequence = 0;
    return createEditableRoot(normalizeFilterNode(controlled ? criteria : defaultCriteria), () => `${reactId}-initial-${++initialSequence}`);
  });
  const [applying, setApplying] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const rootElement = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const editGeneration = useRef(0);
  const edited = useRef(false);
  const lastExternal = useRef(normalizeFilterNode(controlled ? criteria : defaultCriteria));
  const projection = useMemo(() => projectEditable(root, registry, evaluationContext), [evaluationContext, registry, root]);
  const projectionRef = useRef(projection);
  useEffect(() => { projectionRef.current = projection; }, [projection]);
  const dirty = !areFiltersEquivalent(projection.criteria, committed) || projection.incompleteNodeIds.length > 0;
  const blocked = disabled || readOnly || applying;

  const replaceRoot = useCallback((next: EditableGroup) => {
    edited.current = true;
    editGeneration.current += 1;
    setRoot(next);
  }, []);

  useEffect(() => {
    if (!controlled) return;
    const next = normalizeFilterNode(criteria);
    if (areFiltersEquivalent(next, lastExternal.current)) return;
    const hadDraft = !areFiltersEquivalent(projectionRef.current.criteria, lastExternal.current) || projectionRef.current.incompleteNodeIds.length > 0;
    lastExternal.current = next;
    setCommitted(next);
    if (!hadDraft) setRoot(createEditableRoot(next, nextId));
  }, [controlled, criteria, nextId]);

  useEffect(() => { onValidationChange?.(projection); }, [onValidationChange, projection]);

  const apply = useCallback(async (reason: CgFilterBuilderApplyReason = 'action'): Promise<boolean> => {
    const current = projectionRef.current;
    if (!current.valid || disabled || readOnly) {
      setAnnouncement(current.problems[0]?.message ?? 'The filter cannot be applied.');
      return false;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = editGeneration.current;
    const details: CgFilterBuilderApplyDetails = { ...current, reason, signal: controller.signal };
    setApplying(true);
    try {
      const accepted = await onApply?.(current.criteria, details);
      if (controller.signal.aborted || generation !== editGeneration.current || accepted === false) return false;
      if (!controlled) {
        setCommitted(current.criteria);
        lastExternal.current = current.criteria;
      }
      onCriteriaChange?.(current.criteria, { ...current, reason });
      setAnnouncement(current.criteria ? 'Filter applied.' : 'Filter cleared.');
      return true;
    } catch (error) {
      if (!controller.signal.aborted) onApplyError?.(error, details);
      return false;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setApplying(false);
      }
    }
  }, [controlled, disabled, onApply, onApplyError, onCriteriaChange, readOnly]);

  useEffect(() => {
    if (applyMode === 'explicit' || !edited.current || !dirty || !projection.valid) return;
    const generation = editGeneration.current;
    const commit = () => { if (generation === editGeneration.current) void apply(applyMode === 'debounced' ? 'debounce' : 'immediate'); };
    if (applyMode === 'immediate') { queueMicrotask(commit); return; }
    const timer = window.setTimeout(commit, debounceMs);
    return () => window.clearTimeout(timer);
  }, [apply, applyMode, debounceMs, dirty, projection.valid, root]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    edited.current = false;
    editGeneration.current += 1;
    setRoot(createEditableRoot(committed, nextId));
    setAnnouncement('Draft changes cancelled.');
  }, [committed, nextId]);
  const clear = useCallback(() => replaceRoot({ id: nextId(), kind: 'group', operator: 'and', negated: false, collapsed: false, children: [] }), [nextId, replaceRoot]);
  const reset = useCallback(() => replaceRoot(createEditableRoot(defaultCriteria, nextId)), [defaultCriteria, nextId, replaceRoot]);
  const add = useCallback((kind: 'condition' | 'group' | 'aggregate', groupId = root.id) => {
    const node: EditableNode = kind === 'condition' ? emptyCondition(nextId) : kind === 'aggregate' ? emptyAggregate(nextId) : { id: nextId(), kind: 'group', operator: 'and', negated: false, collapsed: false, children: [emptyCondition(nextId)] };
    replaceRoot(editChildren(root, groupId, (children) => [...children, node]));
  }, [nextId, replaceRoot, root]);
  const remove = useCallback((nodeId: string) => replaceRoot(removeEditable(root, nodeId)), [replaceRoot, root]);
  const duplicate = useCallback((nodeId: string) => replaceRoot(duplicateEditable(root, nodeId, nextId)), [nextId, replaceRoot, root]);
  const move = useCallback((nodeId: string, offset: -1 | 1) => replaceRoot(moveEditable(root, nodeId, offset)), [replaceRoot, root]);

  useImperativeHandle(actionsRef, () => ({
    focus: () => rootElement.current?.querySelector<HTMLElement>('select, input, button')?.focus(),
    apply,
    cancel,
    clear,
    reset,
    addCondition: (groupId) => add('condition', groupId),
    addGroup: (groupId) => add('group', groupId),
    addAggregate: (groupId) => add('aggregate', groupId),
    remove,
    duplicate,
    move,
    setGroupOperator: (nodeId, operator) => replaceRoot(updateEditable(root, nodeId, (node) => node.kind === 'group' ? { ...node, operator } : node)),
    setGroupNegated: (nodeId, negated) => replaceRoot(updateEditable(root, nodeId, (node) => node.kind === 'group' ? { ...node, negated } : node)),
    setAggregate: (nodeId, aggregate) => replaceRoot(updateEditable(root, nodeId, (node) => node.kind === 'aggregate' ? { ...node, aggregate, resultOperator: aggregate === 'exists' ? undefined : node.resultOperator ?? 'greaterThanOrEqual', values: aggregate === 'exists' ? [] : node.values } : node)),
    getDraftCriteria: () => projectionRef.current.criteria,
    getValidation: () => projectionRef.current,
  } satisfies CgFilterBuilderActions), [add, apply, cancel, clear, duplicate, move, remove, replaceRoot, reset, root]);

  const valueEditor = (node: EditableCondition | EditableAggregate, field: CgFilterBuilderFieldDescriptor, operator: CgFilterOperator, index: number): ReactNode => {
    const values = node.values;
    const descriptor = CG_FILTER_OPERATOR_REGISTRY.get(operator);
    const setValue = (value: CgFilterValue) => replaceRoot(updateEditable(root, node.id, (candidate) => candidate.kind === 'group' ? candidate : { ...candidate, values: Object.freeze([...candidate.values.slice(0, index), value, ...candidate.values.slice(index + 1)]) }));
    const errorId = `${node.id}-error`;
    const context: CgFilterBuilderEditorContext<TItem> = { nodeId: node.id, field, operator, values, valueIndex: index, describedBy: errorId, disabled: blocked, setValue };
    if (field.renderEditor) return field.renderEditor(context);
    if (renderEditor) return renderEditor(context);
    const value = values[index];
    if (descriptor.editor === 'period') return <select className={styles.select} aria-label={labels.value} aria-describedby={errorId} value={value?.text ?? ''} disabled={blocked} onChange={(event) => setValue(createFilterValue('relativePeriod', event.target.value))}><option value="">Select period</option>{CG_FILTER_PERIODS.map((period) => <option key={period} value={period}>{PERIOD_LABELS[period]}</option>)}</select>;
    if (descriptor.arity === 'many' && field.options) {
      const selected = field.options.filter((option) => values.some((candidate) => candidate.kind === option.value.kind && candidate.text === option.value.text));
      return <CgTagBox options={field.options} value={selected} getOptionKey={(option) => `${option.value.kind}:${option.value.text ?? ''}`} getOptionLabel={(option) => option.label} onValueChange={(options) => replaceRoot(updateEditable(root, node.id, (candidate) => candidate.kind === 'group' ? candidate : { ...candidate, values: options.map((option) => option.value) }))} disabled={blocked} size={size} fullWidth aria-label={labels.value} aria-describedby={errorId} />;
    }
    if (descriptor.arity === 'many') return <CgTextBox value={values.map((candidate) => candidate.text ?? '').join(', ')} onValueChange={(text) => replaceRoot(updateEditable(root, node.id, (candidate) => candidate.kind === 'group' ? candidate : { ...candidate, values: text.split(',').map((entry) => createFilterValue(valueKind(field), entry.trim())).filter((entry) => entry.kind !== 'null') }))} disabled={blocked} size={size} fullWidth aria-label={labels.value} aria-describedby={errorId} />;
    if (field.options) {
      const key = value ? `${value.kind}:${value.text ?? ''}` : null;
      return <CgKeyComboBox options={field.options} value={key} getOptionKey={(option) => `${option.value.kind}:${option.value.text ?? ''}`} getOptionLabel={(option) => option.label} onValueChange={(_key, details) => setValue(details.selectedItem?.value ?? createFilterValue('null'))} disabled={blocked} size={size} fullWidth aria-label={index === 0 ? labels.value : labels.secondValue} aria-describedby={errorId} />;
    }
    if (field.kind === 'boolean') return <select className={styles.select} aria-label={index === 0 ? labels.value : labels.secondValue} aria-describedby={errorId} value={value?.text ?? ''} disabled={blocked} onChange={(event) => setValue(createFilterValue('boolean', event.target.value))}><option value="">Select value</option><option value="true">Yes</option><option value="false">No</option></select>;
    if (field.kind === 'date' || field.kind === 'dateTime') return <CgDateEdit value={value?.text?.slice(0, 10) ?? null} onValueChange={(date) => setValue(createFilterValue('date', date ?? undefined))} disabled={blocked} size={size} fullWidth aria-label={index === 0 ? labels.value : labels.secondValue} aria-describedby={errorId} />;
    if (field.kind === 'number') return <CgNumericEdit value={value?.text ? Number(value.text) : null} onValueChange={(number) => setValue(createFilterValue('number', number === null ? undefined : number.toString()))} onInvalidValue={(draft) => setValue(createFilterValue('number', draft))} disabled={blocked} size={size} fullWidth aria-label={index === 0 ? labels.value : labels.secondValue} aria-describedby={errorId} />;
    return <CgTextBox value={value?.text ?? ''} onValueChange={(text) => setValue(createFilterValue(valueKind(field), text))} disabled={blocked} size={size} fullWidth aria-label={index === 0 ? labels.value : labels.secondValue} aria-describedby={errorId} />;
  };

  const keyboardMove = (event: KeyboardEvent<HTMLElement>, nodeId: string) => {
    if (!event.altKey || event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    move(nodeId, event.key === 'ArrowUp' ? -1 : 1);
    setAnnouncement(event.key === 'ArrowUp' ? 'Filter moved up.' : 'Filter moved down.');
  };

  const rowActions = (node: EditableNode): ReactNode => <div className={styles.rowActions}>
    <button type="button" className={styles.iconButton} disabled={blocked} aria-label={labels.moveUp} title={labels.moveUp} onClick={() => move(node.id, -1)}>↑</button>
    <button type="button" className={styles.iconButton} disabled={blocked} aria-label={labels.moveDown} title={labels.moveDown} onClick={() => move(node.id, 1)}>↓</button>
    <button type="button" className={styles.iconButton} disabled={blocked} aria-label={labels.duplicate} title={labels.duplicate} onClick={() => duplicate(node.id)}>⧉</button>
    <button type="button" className={styles.iconButton} disabled={blocked} aria-label={labels.remove} title={labels.remove} onClick={() => remove(node.id)}>×</button>
  </div>;

  const renderConditionRow = (node: EditableCondition): ReactNode => {
    const field: CgFilterBuilderFieldDescriptor<TItem> | undefined = registry.find(node.fieldId);
    const operators = field ? filterOperatorsForField(field) : [];
    const operator = node.operator;
    const descriptor = operator ? CG_FILTER_OPERATOR_REGISTRY.find(operator) : undefined;
    const invalid = projection.incompleteNodeIds.includes(node.id);
    const error = invalid ? 'Complete this filter row before applying.' : undefined;
    return <div key={node.id} className={styles.row} data-invalid={invalid || undefined} onKeyDown={(event) => keyboardMove(event, node.id)}>
      <select className={styles.select} aria-label={labels.field} value={node.fieldId} disabled={blocked} onChange={(event) => { const selected = registry.find(event.target.value); if (selected) replaceRoot(setEditableField(root, node.id, selected)); }}>
        <option value="">Select field</option>{scalarFields.map((candidate) => <option key={candidate.fieldId} value={candidate.fieldId}>{candidate.label}</option>)}
      </select>
      <select className={styles.select} aria-label={labels.operator} value={node.operator ?? ''} disabled={blocked || !field} onChange={(event) => replaceRoot(setEditableOperator(root, node.id, event.target.value as CgFilterOperator))}>
        <option value="">Select comparison</option>{operators.map((operator) => <option key={operator.operator} value={operator.operator}>{operator.key}</option>)}
      </select>
      {field && operator && descriptor ? Array.from({ length: descriptor.arity === 'two' ? 2 : descriptor.arity === 'none' ? 0 : 1 }, (_, index) => <div className={styles.editor} key={index}>{valueEditor(node, field, operator, index)}</div>) : null}
      {field && operator && (field.renderDisplay || renderDisplay) ? <div>{field.renderDisplay?.({ nodeId: node.id, field, operator, values: node.values }) ?? renderDisplay?.({ nodeId: node.id, field, operator, values: node.values })}</div> : null}
      {rowActions(node)}
      {error ? <div id={`${node.id}-error`} className={styles.error}>{error}</div> : null}
    </div>;
  };

  const renderAggregateRow = (node: EditableAggregate): ReactNode => {
    const field: CgFilterBuilderFieldDescriptor<TItem> | undefined = registry.find(node.collectionFieldId);
    const elementFields = field?.collection?.elementFields ?? [];
    const aggregateField = elementFields.find((candidate) => candidate.fieldId === node.aggregateFieldId);
    const resultField = node.aggregate === 'count' || node.aggregate === 'sum' || node.aggregate === 'average' ? ({ fieldId: field?.fieldId ?? '', label: field?.label ?? '', kind: 'number' } satisfies CgFilterBuilderFieldDescriptor) : aggregateField;
    const invalid = projection.incompleteNodeIds.includes(node.id);
    return <div key={node.id} className={styles.row} data-invalid={invalid || undefined} onKeyDown={(event) => keyboardMove(event, node.id)}>
      <select className={styles.select} aria-label={labels.field} value={node.collectionFieldId} disabled={blocked} onChange={(event) => { const selected = registry.find(event.target.value); if (selected) replaceRoot(setEditableField(root, node.id, selected)); }}><option value="">Select collection</option>{collectionFields.map((candidate) => <option key={candidate.fieldId} value={candidate.fieldId}>{candidate.label}</option>)}</select>
      <select className={styles.select} aria-label="Aggregate" value={node.aggregate} disabled={blocked || !field} onChange={(event) => replaceRoot(updateEditable(root, node.id, (candidate) => candidate.kind === 'aggregate' ? { ...candidate, aggregate: event.target.value as CgFilterAggregate, resultOperator: event.target.value === 'exists' ? undefined : candidate.resultOperator ?? 'greaterThanOrEqual', values: event.target.value === 'exists' ? [] : candidate.values } : candidate))}>{AGGREGATES.filter((aggregate) => (field?.collection?.aggregates ?? ['exists', 'count']).includes(aggregate)).map((aggregate) => <option key={aggregate} value={aggregate}>{aggregate}</option>)}</select>
      {field && node.aggregate !== 'exists' && node.aggregate !== 'count' ? <select className={styles.select} aria-label="Aggregate field" value={node.aggregateFieldId ?? ''} disabled={blocked} onChange={(event) => replaceRoot(updateEditable(root, node.id, (candidate) => candidate.kind === 'aggregate' ? { ...candidate, aggregateFieldId: event.target.value, values: [] } : candidate))}><option value="">Select aggregate field</option>{elementFields.filter((candidate) => candidate.kind !== 'collection').map((candidate) => <option key={candidate.fieldId} value={candidate.fieldId}>{candidate.label}</option>)}</select> : null}
      {field && node.aggregate !== 'exists' ? <select className={styles.select} aria-label={labels.operator} value={node.resultOperator ?? ''} disabled={blocked} onChange={(event) => replaceRoot(setEditableOperator(root, node.id, event.target.value as CgFilterOperator))}><option value="">Select comparison</option>{CG_FILTER_OPERATOR_REGISTRY.all.filter((operator) => operator.allowedForAggregateResult).map((operator) => <option key={operator.operator} value={operator.operator}>{operator.key}</option>)}</select> : null}
      {resultField && node.resultOperator ? <div className={styles.editor}>{valueEditor(node, resultField, node.resultOperator, 0)}</div> : null}
      {field ? <button type="button" className={styles.iconButton} disabled={blocked} onClick={() => replaceRoot(updateEditable(root, node.id, (candidate) => candidate.kind === 'aggregate' ? { ...candidate, nestedCriteria: candidate.nestedCriteria ?? { id: nextId(), kind: 'group', operator: 'and', negated: false, collapsed: false, children: [emptyCondition(nextId)] } } : candidate))}>Where…</button> : null}
      {rowActions(node)}
      {node.nestedCriteria ? <div className={styles.children}>{renderGroup(node.nestedCriteria, false)}</div> : null}
      {invalid ? <div id={`${node.id}-error`} className={styles.error}>Complete this collection filter before applying.</div> : null}
    </div>;
  };

  const renderGroup = (group: EditableGroup, isRoot: boolean): ReactNode => <section key={group.id} className={styles.group} role="group" aria-label={isRoot ? labels.builder : labels.group}>
    <div className={styles.groupHeader}>
      <div className={styles.groupControls}>
        <button type="button" className={styles.iconButton} aria-expanded={!group.collapsed} aria-label={group.collapsed ? labels.expand : labels.collapse} onClick={() => replaceRoot(updateEditable(root, group.id, (node) => node.kind === 'group' ? { ...node, collapsed: !node.collapsed } : node))}>{group.collapsed ? '▸' : '▾'}</button>
        <select className={styles.select} aria-label="Group logic" value={group.operator} disabled={blocked} onChange={(event) => replaceRoot(updateEditable(root, group.id, (node) => node.kind === 'group' ? { ...node, operator: event.target.value as 'and' | 'or' } : node))}><option value="and">All conditions</option><option value="or">Any condition</option></select>
        <label><input type="checkbox" checked={group.negated} disabled={blocked} onChange={(event) => replaceRoot(updateEditable(root, group.id, (node) => node.kind === 'group' ? { ...node, negated: event.target.checked } : node))} /> {labels.negate}</label>
      </div>
      {!isRoot ? rowActions(group) : null}
    </div>
    {!group.collapsed ? <div className={styles.children}>{group.children.map((node) => node.kind === 'group' ? renderGroup(node, false) : node.kind === 'condition' ? renderConditionRow(node) : renderAggregateRow(node))}<div className={styles.groupControls}><CgButton appearance="ghost" size={size} disabled={blocked} onClick={() => add('condition', group.id)}>{labels.addCondition}</CgButton><CgButton appearance="ghost" size={size} disabled={blocked} onClick={() => add('group', group.id)}>{labels.addGroup}</CgButton>{collectionFields.length ? <CgButton appearance="ghost" size={size} disabled={blocked} onClick={() => add('aggregate', group.id)}>{labels.addAggregate}</CgButton> : null}</div></div> : null}
  </section>;

  return <div ref={rootElement} className={joinClass(styles.root, className)} style={style} data-testid={testId} dir={direction === 'auto' ? undefined : direction} aria-busy={applying || undefined}>
    {/* Recursive rows only close over mutable operation refs inside event handlers. */}
    {/* eslint-disable-next-line react-hooks/refs */}
    {renderGroup(root, true)}
    {projection.problems.length ? <div className={styles.error} role="alert">{projection.problems[0]?.message}</div> : null}
    <div className={styles.actions}>
      <CgButton appearance="ghost" size={size} disabled={blocked || !dirty} onClick={cancel}>{labels.cancel}</CgButton>
      <CgButton appearance="ghost" size={size} disabled={blocked} onClick={clear}>{labels.clear}</CgButton>
      <CgButton appearance="ghost" size={size} disabled={blocked} onClick={reset}>{labels.reset}</CgButton>
      <CgButton intent="primary" size={size} loading={applying} loadingContent={labels.applying} disabled={disabled || readOnly || !dirty || !projection.valid} onClick={() => { void apply('apply'); }}>{labels.apply}</CgButton>
    </div>
    <div className={styles.announcement} aria-live="polite" aria-atomic="true">{announcement}</div>
  </div>;
}
