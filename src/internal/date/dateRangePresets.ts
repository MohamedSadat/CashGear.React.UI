import type { CgDateRangeValue, CgDateValue } from '../../types/date';
import { addDays, startOfMonth, startOfYear, endOfYear, parseCanonicalDate, toCanonicalDate } from './dateMath';

export const dateRangePresetKeys = ['last30Days', 'currentMonth', 'lastMonth', 'yearToDate', 'lastYear', 'last2Years', 'custom'] as const;
export type DateRangePresetKey = typeof dateRangePresetKeys[number];

/** Inclusive civil-date boundaries shared by the picker and standalone selector. */
export function resolveDateRangePreset(preset: DateRangePresetKey, anchor: CgDateValue): CgDateRangeValue {
  const date = parseCanonicalDate(anchor);
  if (!date) throw new Error('Preset anchor must be a canonical YYYY-MM-DD date.');
  const range = (start: CgDateValue, end = anchor) => Object.freeze({ start, end });
  switch (preset) {
    case 'last30Days': return range(toCanonicalDate(addDays(date, -29)));
    case 'currentMonth': return range(toCanonicalDate(startOfMonth(date)));
    case 'lastMonth': {
      if (date.year === 1 && date.month === 1) throw new RangeError('No previous month in the supported date range.');
      const previous = addDays(startOfMonth(date), -1);
      return range(toCanonicalDate(startOfMonth(previous)), toCanonicalDate(previous));
    }
    case 'yearToDate': return range(toCanonicalDate(startOfYear(date)));
    case 'lastYear':
    case 'last2Years': {
      const years = preset === 'lastYear' ? 1 : 2;
      if (date.year <= years) throw new RangeError('No previous years in the supported date range.');
      return range(toCanonicalDate({ year: date.year - years, month: 1, day: 1 }), toCanonicalDate(endOfYear({ year: date.year - 1, month: 1, day: 1 })));
    }
    case 'custom': return null;
    default: throw new Error('Unknown date range preset.');
  }
}
