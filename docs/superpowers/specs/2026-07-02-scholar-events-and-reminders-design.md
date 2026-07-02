# Scholar App: Upcoming Events + 24h Reminders — Design

## Context

Second of three planned sub-projects toward: admin schedules events →
the scholar app fetches and displays them → a rebuilt QR scanner app scans
a scholar's QR code at an event and writes an attendance record.

- Sub-project 1 (done): Events — admin scheduling + Firestore persistence.
- **Sub-project 2 (this doc):** scholar-ui11 fetches/displays events, plus a
  24-hours-before local reminder notification.
- Sub-project 3: rebuild `qr scanner/qr_scanner`'s data layer.

## Problem

Admin can now schedule events (sub-project 1), but scholars have no way to
see them, and nothing reminds them a scheduled event is coming up.

## Research findings that shaped this design

- The app has zero push-notification infrastructure on the client (no
  `firebase_messaging`, no native Android/iOS push config). The
  backend (`backend/functions/`) has dormant FCM-sending code and a
  cron-schedule precedent (`rollupReports.js`), but nothing populates
  device tokens from the client, so real server push is not a quick add.
- Per user decision: build this with **local scheduled notifications**
  (`flutter_local_notifications`) instead of finishing the FCM path — no
  backend changes, no native push credentials to configure, fires even
  with the app closed (subject to normal OS constraints on local alarms).
- The `announcements` feature is the existing "admin writes → scholar app
  reads a Firestore collection live" pattern to mirror:
  `ScholarFirestoreService.announcementsStream()` →
  `announcements_provider.dart`.

## Design

### 1. `ScholarFirestoreService.eventsStream()`

New method in `scholar-ui11/lib/core/services/scholar_firestore_service.dart`,
identical shape to `announcementsStream()`:

```dart
static Stream<List<Map<String, dynamic>>> eventsStream() async* {
  await _ensureAuth();
  final firestore = _firestore;
  if (firestore == null) { yield const []; return; }
  yield* firestore
      .collection('events')
      .orderBy('date')
      .snapshots()
      .map((snap) => snap.docs.map((d) => {'id': d.id, ...d.data()}).toList());
}
```

### 2. `events_provider.dart` (new file, `lib/features/events/providers/`)

- `EventModel { id, name, date, required, schoolYear, semester }`.
- `eventsProvider`: `StateNotifierProvider<EventsNotifier, List<EventModel>>`
  subscribing to `eventsStream()`, mapping records the same way
  `AnnouncementsNotifier._mapRecord` does.
- `upcomingEventsProvider`: derived `Provider<List<EventModel>>` filtering to
  `date >= today`, already sorted ascending (soonest first) by the query.

### 3. UI: Attendance screen gains an "Upcoming Events" section

In `scholar-ui11/lib/features/attendance/screens/attendance_screen.dart`,
add a new section above "Activity History": a card per upcoming event
showing name, formatted date, and a "Required" badge when applicable.
Empty state: "No upcoming events." No new nav item or route — this screen
is already the natural home for "what's coming up" next to "what's already
been recorded."

### 4. 24-hours-before local reminder

- Add `flutter_local_notifications` and `timezone` to `pubspec.yaml`.
- Add Android `POST_NOTIFICATIONS` permission + a notification channel;
  initialize the plugin (and request permission) once at app startup in
  `main.dart`.
- A new `event_reminder_service.dart` (or a method on the events provider)
  runs whenever `upcomingEventsProvider` updates: for each upcoming event,
  compute the reminder moment as **8:00 AM the day before the event's
  date** (events only carry a date, not a time-of-day, so this stands in
  for "~24 hours before" without firing at midnight). If that moment is
  still in the future, schedule a local notification for it via
  `zonedSchedule` with `AndroidScheduleMode.exactAllowWhileIdle`.
- **Idempotency:** the notification's integer ID is a stable hash of the
  event's Firestore doc id, so re-running this on every app launch
  reschedules/overwrites the same notification instead of duplicating it.
- Notification content: title "Upcoming Event", body
  `"<Event Name> is tomorrow (<date>)."`.

## Out of scope

- Server-side FCM push (explicitly deferred per the local-notifications
  decision).
- Per-school or per-semester filtering of which events a scholar sees —
  all scholars see all events, matching how events currently have no
  audience-targeting field.
- Sub-project 3 (QR scanner rebuild).
