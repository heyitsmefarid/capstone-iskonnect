# QR Scanner: Fetch Events From Admin Instead Of Creating Locally — Design

## Context

Part of sub-project 3 (rebuilding the `qr scanner/qr_scanner` app's data
layer against the real production schema). This piece is scoped narrowly
to event sourcing, per explicit user request — the QR-payload-parsing and
attendance-write pipeline are a separate, later concern.

## Research findings

- Events in `qr_scanner` today are 100% local: a Hive box (`events`,
  `Event{id, name, description, date, isActive, createdAt}`), CRUD via
  `StorageService`, with "current event" just an id pointer stored in a
  `settings` Hive box. Nothing syncs events to/from Firestore. On first
  launch, `_ensureDefaultEvent()` seeds a placeholder `'General
  Attendance'` event and sets it current.
- "Manage" (from the dashboard's event card) opens `_showEventSelector`
  (duplicated in `home_screen.dart` and `scanner_screen.dart`), which lists
  local events and lets the user set the current one or add a new one via
  `_showAddEventDialog` → `AttendanceProvider.addEvent(...)`.
- The actual scan-to-Firestore write path (`sync_service.dart`) is
  *already* compatible with what admin-ui reads: it writes
  `arrayUnion` onto `users/{id}.attendance` with
  `{activity: record.eventName, present: true, date, markedVia:
  'qr_scanner', ...}` — `Attendance.jsx` already has fallback rendering
  for `markedVia === 'qr_scanner'`. No changes needed there for this piece.
- Firebase already points at the correct project (`iskonnect-15238`), same
  as admin-ui and scholar-ui11.

## Design

### 1. New `eventsStream()` in a Firestore-backed events source

Mirrors the pattern used in admin-ui/scholar-ui11: reads the `events`
collection admin-ui writes to, ordered by `date` descending (newest/
upcoming events surface near the top of the picker). Add this as a method
on a new `lib/services/events_service.dart` (or alongside the existing
`FirebaseConfig`), returning `Stream<List<Map<String, dynamic>>>`.

### 2. `AttendanceProvider` changes

- Subscribes to `eventsStream()` on init. Each snapshot maps records into
  the existing `Event` model (reused as the in-memory shape so the rest of
  the UI — event selector, "current event" card — needs no redesign) and
  updates `provider.events`.
- Each fetch is also cached into the existing local Hive `events` box, so
  the event list survives if the device goes offline mid-shift (matches
  the app's existing offline-first design — connectivity indicator,
  pending-sync counter).
- `_ensureDefaultEvent()`'s placeholder-seeding is removed — no more fake
  "General Attendance" auto-created on first launch, since it doesn't
  correspond to a real admin-scheduled event and would produce orphaned
  attendance records.
- `addEvent(...)` is removed (no longer reachable once its only UI trigger
  is gone).

### 3. UI changes

- `_showAddEventDialog` and its trigger button removed from both
  `home_screen.dart` and `scanner_screen.dart`.
- `_showEventSelector` keeps its list/selection behavior, now sourced from
  `provider.events` (Firestore-backed). Add a loading state (events still
  fetching) and an empty state ("No events scheduled yet") for when the
  admin hasn't scheduled anything.
- Dashboard: when no event is currently selected, show a prompt state
  ("Select an event to start scanning") instead of defaulting to a fake
  bucket — selecting an event becomes a required step before scanning is
  meaningful, matching the user's intent of deliberately choosing which
  admin-scheduled event the scanner is recording attendance for.

## Out of scope (later, separate pieces)

- QR payload parsing / student lookup correctness against the real
  scholar app's QR format.
- Any change to the attendance-write shape (already compatible, per
  research above).
- Offline queueing behavior beyond the existing sync_service.dart flow.
