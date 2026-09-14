export interface CgSchedulerResource { readonly id: string | number; readonly caption: string; readonly groupId?: string | number; readonly isGroup?: boolean; readonly color?: string; readonly className?: string }
export interface CgSchedulerAppointmentLabel { readonly id: string | number; readonly caption: string; readonly color?: string; readonly className?: string }
export type CgSchedulerAppointmentStatus = CgSchedulerAppointmentLabel;
export type CgSchedulerGroupType = 'none' | 'resource' | 'date';
export function resourceKey(id: string | number): string { return `${typeof id}:${id}`; }
export function validateResources(resources: readonly CgSchedulerResource[]): void {
  const keys = new Set<string>();
  for (const resource of resources) {
    if (!(typeof resource.id === 'string' ? resource.id.trim() : typeof resource.id === 'number' && Number.isFinite(resource.id))) throw new Error('Scheduler resource IDs must be nonempty strings or finite numbers.');
    const key = resourceKey(resource.id); if (keys.has(key)) throw new Error(`Duplicate Scheduler resource ID: ${resource.id}`); keys.add(key);
  }
  const map = new Map(resources.map(resource => [resourceKey(resource.id), resource]));
  for (const resource of resources) {
    const visited = new Set<string>(); let current: CgSchedulerResource | undefined = resource;
    while (current) { const key = resourceKey(current.id); if (visited.has(key)) throw new Error('Scheduler resource groups contain a cycle.'); visited.add(key); if (current.groupId === undefined) break; const parent: CgSchedulerResource | undefined = map.get(resourceKey(current.groupId)); if (!parent?.isGroup) throw new Error('Scheduler resource group must reference a group descriptor.'); current = parent; }
  }
}
export interface ViewColumn { date: string; resource?: CgSchedulerResource; key: string }
export function resourceColumns(dates: readonly string[], resources: readonly CgSchedulerResource[], group: CgSchedulerGroupType): readonly ViewColumn[] {
  if (group === 'none' || !resources.length) return dates.map(date => ({ date, key: date }));
  const column = (date: string, resource: CgSchedulerResource): ViewColumn => ({ date, resource, key: `${date}@${resourceKey(resource.id)}` });
  return group === 'resource' ? resources.flatMap(resource => dates.map(date => column(date, resource))) : dates.flatMap(date => resources.map(resource => column(date, resource)));
}
export function matchesResource(resourceIds: readonly (string | number)[] | undefined, resource: CgSchedulerResource | undefined): boolean { return !resource || !!resourceIds?.some(id => resourceKey(id) === resourceKey(resource.id)); }
