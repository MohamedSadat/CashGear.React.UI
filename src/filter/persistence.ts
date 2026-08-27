import { CgFilterCodecError, decodeFilterNode, encodeFilterNode } from './codec';
import { buildFilterSchemaSignature } from './fields';
import type { CgFilterFieldRegistry } from './fields';
import { mapFilterFieldIds } from './tree';
import type {
  CgFilterEvaluationContext, CgFilterFieldDescriptor, CgFilterLoadResult, CgFilterNode, CgFilterProblem, CgFilterSavedView, CgFilterScope,
} from './types';
import { validateFilter } from './validation';

export interface CgFilterSavedViewInput {
  readonly filterKey: string;
  readonly name: string;
  readonly scope?: CgFilterScope;
  readonly roleName?: string;
  readonly isDefault?: boolean;
  readonly criteria: CgFilterNode | null;
  readonly concurrencyToken?: string;
}

export interface CgFilterLoadOptions<TItem> {
  readonly isAuthorized?: (field: CgFilterFieldDescriptor<TItem>) => boolean;
  readonly evaluationContext?: CgFilterEvaluationContext;
}

export class CgFilterPersistenceError extends Error {
  readonly problems: ReadonlyArray<CgFilterProblem>;
  constructor(message: string, problems: ReadonlyArray<CgFilterProblem> = []) {
    super(message);
    this.name = 'CgFilterPersistenceError';
    this.problems = problems;
  }
}

function required(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new CgFilterPersistenceError(`${label} must not be blank.`);
  return value.trim();
}

export function captureFilterSavedView<TItem>(
  input: CgFilterSavedViewInput,
  fields: CgFilterFieldRegistry<TItem>,
  options: CgFilterLoadOptions<TItem> = {},
): CgFilterSavedView {
  const validation = validateFilter(input.criteria, fields, { scope: 'persist', isAuthorized: options.isAuthorized, evaluationContext: options.evaluationContext });
  if (!validation.valid) throw new CgFilterPersistenceError('The filter cannot be saved.', validation.problems);
  return Object.freeze({
    version: 1, filterKey: required(input.filterKey, 'Filter key'), name: required(input.name, 'Saved-view name'),
    scope: input.scope ?? 'personal', ...(input.roleName ? { roleName: input.roleName } : {}),
    ...(input.isDefault ? { isDefault: true } : {}), schemaSignature: buildFilterSchemaSignature(fields.all),
    criteria: input.criteria ? decodeFilterNode(input.criteria) : null,
    ...(input.concurrencyToken ? { concurrencyToken: input.concurrencyToken } : {}),
  });
}

export function serializeFilterSavedView(view: CgFilterSavedView): string {
  return JSON.stringify({ ...view, criteria: encodeFilterNode(view.criteria) });
}

export function deserializeFilterSavedView(json: string): CgFilterSavedView {
  let parsed: unknown;
  try { parsed = JSON.parse(json) as unknown; }
  catch { throw new CgFilterPersistenceError('The saved filter is not valid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CgFilterPersistenceError('The saved filter must be an object.');
  const value = parsed as Record<string, unknown>;
  if (value.version !== 1) throw new CgFilterPersistenceError(`Unsupported saved-filter version '${String(value.version)}'.`);
  if (value.scope !== 'personal' && value.scope !== 'role' && value.scope !== 'company') throw new CgFilterPersistenceError(`Unknown saved-filter scope '${String(value.scope)}'.`);
  try {
    return Object.freeze({
      version: 1, filterKey: required(value.filterKey, 'Filter key'), name: required(value.name, 'Saved-view name'), scope: value.scope,
      ...(typeof value.roleName === 'string' ? { roleName: value.roleName } : {}), ...(value.isDefault === true ? { isDefault: true } : {}),
      schemaSignature: required(value.schemaSignature, 'Schema signature'), criteria: decodeFilterNode(value.criteria),
      ...(typeof value.concurrencyToken === 'string' ? { concurrencyToken: value.concurrencyToken } : {}),
    });
  } catch (error) {
    if (error instanceof CgFilterPersistenceError) throw error;
    if (error instanceof CgFilterCodecError) throw new CgFilterPersistenceError(error.message);
    throw error;
  }
}

export function loadFilterSavedView<TItem>(
  view: CgFilterSavedView,
  fields: CgFilterFieldRegistry<TItem>,
  options: CgFilterLoadOptions<TItem> = {},
): CgFilterLoadResult {
  const schemaSignature = buildFilterSchemaSignature(fields.all);
  const criteria = mapFilterFieldIds(view.criteria, (fieldId) => fields.migrate(fieldId));
  const validation = validateFilter(criteria, fields, { scope: 'apply', isAuthorized: options.isAuthorized, evaluationContext: options.evaluationContext });
  return Object.freeze({ criteria, problems: validation.problems, succeeded: validation.valid, schemaChanged: schemaSignature !== view.schemaSignature });
}
