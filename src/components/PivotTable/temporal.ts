import { CgPivotError } from './model';

/** Normalize temporal keys without losing CLR's seven fractional-second digits. */
export function temporalKey(value: string, type: 'date' | 'dateTime' | 'instant'): string {
  const match = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,7}))?)?(Z|[+-]\d\d:\d\d)?)?$/.exec(value);
  if (!match || type === 'date' && match[4] || type !== 'date' && !match[4] || type === 'instant' && !match[8] || type === 'dateTime' && match[8]) throw new CgPivotError('Invalid canonical temporal type.');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4] ?? 0), minute = Number(match[5] ?? 0), second = Number(match[6] ?? 0);
  const civil = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (year < 1 || civil.getUTCFullYear() !== year || civil.getUTCMonth() + 1 !== month || civil.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) throw new CgPivotError('Invalid pivot date.');
  if (type === 'date') return value;
  const time = `${value.slice(0,10)}T${match[4]}:${match[5]}:${String(second).padStart(2,'0')}`;
  const fraction = (match[7] ?? '').padEnd(7, '0');
  if (type === 'dateTime') return `${time}.${fraction}`;
  const offset = match[8]!;
  if (offset !== 'Z' && (Number(offset.slice(1,3)) > 14 || Number(offset.slice(4)) > 59 || Number(offset.slice(1,3)) === 14 && Number(offset.slice(4)) !== 0)) throw new CgPivotError('Invalid instant offset.');
  const utc = new Date(time + offset).toISOString();
  if (utc.length !== 24 || utc.startsWith('0000')) throw new CgPivotError('Pivot instant exceeds supported years.');
  return `${utc.slice(0,19)}.${fraction}Z`;
}
