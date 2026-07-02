# Events: Admin Scheduling + Persistence — Design

## Context

This is the first of three planned sub-projects toward: admin schedules
events → the scholar app fetches and displays them → a rebuilt QR scanner
app scans a scholar's QR code at an event and writes an attendance record
that shows up in both admin-ui and the scholar app, tagged with the
semester it belongs to.

- **Sub-project 1 (this doc):** Events — admin scheduling + real persistence.
- **Sub-project 2:** scholar-ui11 fetches and displays events.
- **Sub-project 3:** rebuild `qr scanner/qr_scanner`'s data layer against the
  real schema so it scans scholars and writes attendance records.

## Problem

Admin-ui already has an "Activities" concept (`admin-ui/src/context/AppContext.jsx`:
`activities` state, `addActivity`/`updateActivity`/`deleteActivity`, managed
from a modal in `admin-ui/src/pages/Attendance.jsx`) — but it's pure local
React state. Nothing persists it to Firestore, so every event an admin
creates disappears on page refresh. There's also no semester/school-year
tagging on an event, so there's no way to scope which term it belongs to
(the way grades, enrollment, and scholar records already are via
`schoolYear`/`semester` fields).

## Design

### 1. New Firestore collection: `events`

Each document:

```
{
  name: string,
  date: string,        // existing date field, unchanged format
  required: boolean,
  schoolYear: string,   // e.g. "2026-2027" — matches the SchoolYearManagement label format
  semester: string,     // e.g. "1st Semester" — matches existing semester vocabulary
  createdAt: number,
}
```

Firestore's own document id is authoritative (read into state as
`firestoreId`, matching how `announcements` already works) — no separate
`id` field is written.

### 2. `AppContext.jsx`

Rename the existing local-only activity primitives to match the real
feature name, and back them with Firestore exactly like `announcements`
already works:

- `activities` state → `events`, populated by a live
  `onSnapshot(collection(db, 'events'))` listener (gated on `authReady`,
  same as the announcements listener), sorted by `date`.
- `addActivity(data)` → `addEvent(data)`:
  `addDoc(collection(db, 'events'), { name, date, required, schoolYear, semester, createdAt: Date.now() })`.
- `updateActivity(id, data)` → `updateEvent(firestoreId, data)`:
  `setDoc(doc(db, 'events', firestoreId), { name, date, required, schoolYear, semester }, { merge: true })`.
- `deleteActivity(id)` → `deleteEvent(firestoreId)`:
  `deleteDoc(doc(db, 'events', firestoreId))`.
- The old numeric local `id` is gone; every consumer switches to the
  Firestore `firestoreId`.

### 3. `Attendance.jsx`

- Renamed usages to match: `events`, `addEvent`, `updateEvent`,
  `deleteEvent`, `selectedEvent`, `eventForm`, etc.
- The Add/Edit Event modal gains School Year and Semester dropdowns,
  sourced from the existing (already Firestore-backed) `schoolYears`
  context state — the same list SchoolYearManagement.jsx already manages —
  defaulting to whichever term is currently marked active when creating a
  new event.
- The event list/table gains a School Year / Semester column so admins can
  see at a glance which term each event belongs to.
- Attendance-matching logic (`getAbsenceCount` and friends, which match a
  scholar's `attendance` array entries to an activity by its `.name`
  string) is unchanged — semester is descriptive metadata on the event
  itself for this sub-project, not a new matching key.

## Out of scope

- The scholar app fetching/displaying events (sub-project 2).
- QR-scan-driven attendance writing (sub-project 3).
- Using `schoolYear`/`semester` to filter which events/attendance a
  scholar sees — that's part of sub-project 2's design, not this one.
