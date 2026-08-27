import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CgFilterNode } from '../../filter';
import { CgFilterBuilder } from './CgFilterBuilder';
import type { CgFilterBuilderFieldDescriptor } from './CgFilterBuilder.types';

interface Line { sku: string; quantity: number }
interface RecordItem { name: string; amount: number; active: boolean; issued: string; status: string; lines: ReadonlyArray<Line> }
const lineFields: ReadonlyArray<CgFilterBuilderFieldDescriptor<Line>> = [
  { fieldId: 'sku', label: 'SKU', kind: 'text', accessor: (line) => line.sku },
  { fieldId: 'quantity', label: 'Quantity', kind: 'number', accessor: (line) => line.quantity },
];
const fields: ReadonlyArray<CgFilterBuilderFieldDescriptor<RecordItem>> = [
  { fieldId: 'name', label: 'Name', kind: 'text', accessor: (item) => item.name },
  { fieldId: 'amount', label: 'Amount', kind: 'number', accessor: (item) => item.amount },
  { fieldId: 'active', label: 'Active', kind: 'boolean', accessor: (item) => item.active },
  { fieldId: 'issued', label: 'Issued', kind: 'date', accessor: (item) => item.issued },
  { fieldId: 'status', label: 'Status', kind: 'enumeration', accessor: (item) => item.status, options: ['Open', 'Paid', 'Held'].map((text) => ({ value: { kind: 'text', text }, label: text })) },
  { fieldId: 'lines', label: 'Lines', kind: 'collection', accessor: (item) => item.lines, collection: { elementFields: lineFields, aggregates: ['exists', 'count', 'sum'], elementLabel: 'line' } },
];
const nested: CgFilterNode = { kind: 'group', operator: 'and', negated: false, children: [
  { kind: 'condition', fieldId: 'status', operator: 'isAnyOf', values: [{ kind: 'text', text: 'Open' }, { kind: 'text', text: 'Held' }], source: 'builder' },
  { kind: 'group', operator: 'or', negated: true, children: [
    { kind: 'condition', fieldId: 'amount', operator: 'between', values: [{ kind: 'number', text: '1000' }, { kind: 'number', text: '5000' }], source: 'builder' },
    { kind: 'condition', fieldId: 'issued', operator: 'inPeriod', values: [{ kind: 'relativePeriod', text: 'thisMonth' }], source: 'builder' },
  ] },
] };
const evaluationContext = { now: () => new Date('2026-08-27T09:00:00Z'), timeZone: 'Africa/Cairo', firstDayOfWeek: 6 as const };

const meta: Meta = { title: 'Phase 15/FilterBuilder', component: CgFilterBuilder };
export default meta;
type Story = StoryObj;

export const ExplicitNested: Story = { render: () => <CgFilterBuilder fields={fields} defaultCriteria={nested} evaluationContext={evaluationContext} /> };
export const InvalidDraft: Story = { render: () => <CgFilterBuilder fields={fields} defaultCriteria={{ kind: 'condition', fieldId: 'amount', operator: 'between', values: [], source: 'builder' }} /> };
export const CollectionAggregate: Story = { render: () => <CgFilterBuilder fields={fields} defaultCriteria={{ kind: 'aggregate', collectionFieldId: 'lines', aggregate: 'count', resultOperator: 'greaterThan', values: [{ kind: 'number', text: '2' }], source: 'builder' }} /> };

function ControlledExample() {
  const [criteria, setCriteria] = useState<CgFilterNode | null>(nested);
  return <CgFilterBuilder fields={fields} criteria={criteria} onCriteriaChange={(next) => setCriteria(next)} applyMode="immediate" evaluationContext={evaluationContext} />;
}
export const ControlledImmediate: Story = { render: () => <ControlledExample /> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <CgFilterBuilder fields={fields} defaultCriteria={nested} evaluationContext={evaluationContext} size="small" /> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 420 }}><CgFilterBuilder fields={fields} defaultCriteria={nested} evaluationContext={evaluationContext} direction="rtl" labels={{ builder: 'منشئ عوامل التصفية', field: 'الحقل', operator: 'العامل', value: 'القيمة', apply: 'تطبيق', cancel: 'إلغاء', clear: 'مسح' }} /></div> };
export const ForcedColors: Story = { parameters: { backgrounds: { default: 'light' } }, render: () => <CgFilterBuilder fields={fields} defaultCriteria={nested} evaluationContext={evaluationContext} /> };
export const ReducedMotion: Story = { render: () => <CgFilterBuilder fields={fields} defaultCriteria={nested} evaluationContext={evaluationContext} /> };
