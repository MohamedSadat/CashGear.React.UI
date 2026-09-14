# CgScheduler

Generic React scheduler adapted from the core of `CashGear.Blazor.UI` at `1e327060d65c8ae7e94088b24014cb7ebbd72714`. No scheduler or date-library runtime dependency is required.

```tsx
import { CgScheduler } from '@cashgear/ui';
import '@cashgear/ui/styles.css';

<CgScheduler
  items={appointments}
  idSelector={(item) => item.id}
  titleSelector={(item) => item.title}
  startSelector={(item) => item.start}
  endSelector={(item) => item.end}
  allDaySelector={(item) => item.isAllDay}
  defaultSelectedDate="2026-09-07"
  defaultCurrentView="week"
  displayTimeZone="Africa/Cairo"
  onAppointmentCreating={async ({ draft }, signal) => {
    await api.create(draft, { signal });
    setAppointments(await api.list({ signal }));
    return { success: true };
  }}
/>
```

## Dates, views, and selection

Instants use JavaScript millisecond precision. Fractional seconds from .NET (up to nine input digits) are accepted and truncated to milliseconds; emitted drafts use three fractional digits.

`selectedDate` is a Gregorian `YYYY-MM-DD` date in `displayTimeZone` (IANA name, default UTC). Appointment start/end selectors return ISO strings with explicit `Z` or numeric offsets; callback drafts contain UTC strings. Slots walk real instants, including repeated hours and skipped DST hours. Wall-time editor input chooses the earlier occurrence of a repeated time and advances a nonexistent time to the first valid minute. All-day dates have an exclusive end: a one-day item ends at the next local midnight. Invalid or duplicate IDs throw; intervals with end at/before start are ignored.

Views are `day`, `workWeek`, `week`, `month`, and `timeline`. Defaults are Week, 30-minute slots/minimum duration, Monday–Friday working days, 08:00–17:00 work hours, full-day visibility, a one-day Timeline with hourly cells, and three visible month lanes. `firstDayOfWeek` otherwise follows `locale`. Height defaults to 42rem. `dayCount`, `monthCount`, `showWorkTimeOnly`, visible/work times, Timeline duration/scale, and month limit configure the core views. Durations are minutes; clock strings use `HH:mm`, with `24:00` allowed for end times.

Date, view, and selected appointment ID each support controlled props, corresponding `default*` props, and change callbacks. Slot selection is reported through `onSelectionChange`; `onVisibleRangeChange` reports the half-open display range. Keyboard arrows move focus, Enter/Space activate, Delete confirms deletion, and Escape cancels selection or an interaction. Horizontal arrows follow RTL. Double-click suppresses the pending single-click notification.

## Loading and persistence

Supply either `items` or `itemsProvider`, never both. The provider receives `{ range, view, signal }` and returns `Promise<readonly TItem[]>`. Range changes and unmount cancel requests; late responses are ignored. Errors expose Retry. Provider mode reloads after successful persistence. This core version has no resource filter.

Create, update, delete, drag, and resize have separate `onAppointment*` callbacks. Each receives an immutable scheduler-owned draft, original item/draft (null for creation), interaction source, optional resize edge, and an `AbortSignal`. Drag and resize do not invoke update. The scheduler never mutates items or inserts optimistic data: hosts persist and replace local items, or return success and let provider mode reload. Return `{ success: false, error, fieldErrors }` to retain the editor and show errors; thrown errors show a generic failure. Cancellation, navigation, permission changes, and unmount invalidate pending completions.

An action requires both its handler and permission; all `allow*Appointment` flags default true. `readOnly` disables mutations while preserving navigation/selection. `disabled` also suppresses selection and toolbar interaction. Saving suppresses duplicate submissions; Cancel aborts a pending save. All-day dragging uses display dates, timed dragging snaps to `timeInterval`, and resizing enforces the rounded minimum duration. Pointer range selection feeds the Create action.

## Customization and boundaries

`renderAppointment`, `renderTimeCell`, `renderDateHeader`, `renderToolbar`, and `renderEditor` receive typed contexts. Custom editor content stays inside the scheduler's popup and uses `setDraft`; Save/Delete/Cancel remain scheduler-owned. Appointment templates should contain presentation content, not nested interactive controls. `labels` overrides English/Arabic strings. `direction`, host theme tokens, item colors/classes, root `className`/`style`, and injectable `now()` support branding, RTL, and deterministic tests. Custom CSS properties include `--cg-scheduler-bg`, `--cg-scheduler-text`, and per-item `--cg-scheduler-appointment-color`.

Deliberately deferred: recurrence/occurrence editing, resources, labels/status taxonomies, reminders, iCalendar export, advanced Timeline scales, tooltip lifecycle customization, and imperative Blazor methods. Host callbacks own authorization and persistence. Date inputs use browser-native controls; all-day End displays the exclusive end date. Existing Popup supplies focus trapping/restoration.

## Recurrence (Phase 32A)

Recurrence is opt-in through `enableRecurrence` and `recurrenceSelector`. Immutable rules support daily/weekly/monthly/yearly patterns, positive intervals, weekday/nth-weekday/month rules, count/end-date/no-end ranges, and deleted/replaced/restored exceptions. Expansion is bounded to 500,000 candidates and fails explicitly for unrepresentable or impossible patterns. Timed patterns preserve local wall-clock starts across DST; all-day occurrences retain exclusive local-midnight ends. A moved exception remains discoverable when its original pattern date is outside the visible range.

Appointment IDs remain host IDs. `originalOccurrenceStart` distinguishes repeated occurrences in render/selection contexts and operation requests; `selectedOccurrenceStart` optionally controls that part of selection. Editor scope defaults to the occurrence, with an explicit series option; `recurringAppointmentDragMode` controls pointer scope. Operation drafts contain an owned, frozen recurrence snapshot. Hosts persist occurrence changes as recurrence exceptions; removing an exception restores the original occurrence. Nonrecurring draft fields and handlers remain compatible.

## Resources and customization (Phase 32B)

`resources`, `resourceIdsSelector`, and controlled/uncontrolled `visibleResourceIds` provide a checkbox navigator and provider-visible resource snapshots. `groupType` orders day/week columns by resource or date; Timeline creates one row per resource. Month retains the source's date layout and applies the visible-resource filter. Numeric and string IDs remain distinct. Invalid/duplicate/cyclic resource descriptors fail explicitly. Cross-resource dragging is independently permission-controlled.

Location, appointment labels (`appointmentLabels`, distinct from the existing localization `labels`), statuses, resource assignments and custom fields are optional draft/selector metadata. `customFields` declares supported editor fields and validation. Persistence stays host-owned. Render callbacks retain general appointment/time-cell precedence over specialized horizontal/vertical/all-day renderers. Resource/date/day-of-week headers, editor headers, tooltip headers/body, and cell decorations are additive.

`timelineScales` supports second through year scales, multiple scale headers and calendar-month arithmetic. The final scale sets the base interval; `timelineStartTime` shifts the visible start. Existing numeric Timeline defaults remain unchanged. Optional cell sizing/indents, workday visibility, time indicator modes, timezone navigation and snapping configure the layout. Timeline rendering fails above 50,000 cells rather than exhausting the browser.

`appointmentFormOptions` and `appointmentTooltipOptions` reuse Popup sizing, positioning, dragging and resizing contracts. Showing/closing callbacks may return false or a PromiseLike result to cancel; shown/closed callbacks describe lifecycle completion. Pending opening is aborted on ownership/permission changes or unmount. Version/context/resource/provider changes invalidate stale provider and save work. Tooltips are mounted UI only, and are opt-in through `showAppointmentTooltip`.
