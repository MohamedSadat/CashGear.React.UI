import type { ReactNode, Ref } from 'react';
import type {
  CgFilterAggregate, CgFilterEvaluationContext, CgFilterFieldDescriptor, CgFilterLogicalOperator,
  CgFilterNode, CgFilterOperator, CgFilterProblem, CgFilterValue,
} from '../../filter';
import type { CgBaseProps, CgDirection, CgSizeMode } from '../../types';

export type CgFilterBuilderApplyMode = 'explicit' | 'debounced' | 'immediate';
export type CgFilterBuilderApplyReason = 'apply' | 'immediate' | 'debounce' | 'clear' | 'reset' | 'action';
export type CgFilterBuilderNodeKind = 'group' | 'condition' | 'aggregate';

export interface CgFilterBuilderNodeDescriptor {
  readonly id: string;
  readonly kind: CgFilterBuilderNodeKind;
  readonly depth: number;
  readonly collapsed?: boolean;
}

export interface CgFilterBuilderValidationDetails {
  readonly valid: boolean;
  readonly problems: ReadonlyArray<CgFilterProblem>;
  readonly incompleteNodeIds: ReadonlyArray<string>;
}

export interface CgFilterBuilderChangeDetails extends CgFilterBuilderValidationDetails {
  readonly reason: CgFilterBuilderApplyReason;
}

export interface CgFilterBuilderApplyDetails extends CgFilterBuilderChangeDetails {
  readonly signal: AbortSignal;
}

export type CgFilterBuilderCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgFilterBuilderEditorContext<TItem> {
  readonly nodeId: string;
  readonly field: CgFilterBuilderFieldDescriptor<TItem>;
  readonly operator: CgFilterOperator;
  readonly values: ReadonlyArray<CgFilterValue>;
  readonly valueIndex: number;
  readonly describedBy?: string;
  readonly disabled: boolean;
  readonly setValue: (value: CgFilterValue) => void;
}

export interface CgFilterBuilderDisplayContext<TItem> {
  readonly nodeId: string;
  readonly field: CgFilterBuilderFieldDescriptor<TItem>;
  readonly operator: CgFilterOperator;
  readonly values: ReadonlyArray<CgFilterValue>;
}

export interface CgFilterBuilderFieldDescriptor<TItem = unknown> extends CgFilterFieldDescriptor<TItem> {
  readonly renderEditor?: (context: CgFilterBuilderEditorContext<TItem>) => ReactNode;
  readonly renderDisplay?: (context: CgFilterBuilderDisplayContext<TItem>) => ReactNode;
}

export interface CgFilterBuilderLabels {
  readonly builder: string;
  readonly group: string;
  readonly field: string;
  readonly operator: string;
  readonly value: string;
  readonly secondValue: string;
  readonly addCondition: string;
  readonly addGroup: string;
  readonly addAggregate: string;
  readonly duplicate: string;
  readonly remove: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly negate: string;
  readonly collapse: string;
  readonly expand: string;
  readonly apply: string;
  readonly cancel: string;
  readonly clear: string;
  readonly reset: string;
  readonly applying: string;
}

export interface CgFilterBuilderActions {
  focus: () => void;
  apply: (reason?: CgFilterBuilderApplyReason) => Promise<boolean>;
  cancel: () => void;
  clear: () => void;
  reset: () => void;
  addCondition: (groupId?: string) => void;
  addGroup: (groupId?: string) => void;
  addAggregate: (groupId?: string) => void;
  remove: (nodeId: string) => void;
  duplicate: (nodeId: string) => void;
  move: (nodeId: string, offset: -1 | 1) => void;
  setGroupOperator: (nodeId: string, operator: CgFilterLogicalOperator) => void;
  setGroupNegated: (nodeId: string, negated: boolean) => void;
  setAggregate: (nodeId: string, aggregate: CgFilterAggregate) => void;
  getDraftCriteria: () => CgFilterNode | null;
  getValidation: () => CgFilterBuilderValidationDetails;
}

export interface CgFilterBuilderProps<TItem> extends CgBaseProps {
  readonly fields: ReadonlyArray<CgFilterBuilderFieldDescriptor<TItem>>;
  readonly criteria?: CgFilterNode | null;
  readonly defaultCriteria?: CgFilterNode | null;
  readonly onCriteriaChange?: (criteria: CgFilterNode | null, details: CgFilterBuilderChangeDetails) => void;
  readonly onApply?: (criteria: CgFilterNode | null, details: CgFilterBuilderApplyDetails) => CgFilterBuilderCancelableResult;
  readonly onApplyError?: (error: unknown, details: CgFilterBuilderApplyDetails) => void;
  readonly onValidationChange?: (details: CgFilterBuilderValidationDetails) => void;
  readonly applyMode?: CgFilterBuilderApplyMode;
  readonly debounceMs?: number;
  readonly evaluationContext?: CgFilterEvaluationContext;
  readonly isFieldAuthorized?: (field: CgFilterBuilderFieldDescriptor<TItem>) => boolean;
  readonly renderEditor?: (context: CgFilterBuilderEditorContext<TItem>) => ReactNode;
  readonly renderDisplay?: (context: CgFilterBuilderDisplayContext<TItem>) => ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly size?: CgSizeMode;
  readonly direction?: CgDirection;
  readonly labels?: Partial<CgFilterBuilderLabels>;
  readonly actionsRef?: Ref<CgFilterBuilderActions>;
}
