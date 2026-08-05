import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:iskonnectttt/features/announcements/providers/announcements_provider.dart';
import 'package:iskonnectttt/features/attendance/providers/attendance_provider.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/features/messaging/providers/messaging_provider.dart';
import 'package:iskonnectttt/features/profile/providers/scholarship_timeline_provider.dart';

/// Disposes every provider that loads one scholar's data once, into a plain
/// (non-`autoDispose`) `StateNotifier`, at construction time.
///
/// None of these re-fetch on their own when the signed-in scholar changes:
/// each reads `ScholarFirestoreService.currentStudentId()` (or opens a
/// Firestore stream keyed to it) exactly once, inside its constructor. A
/// `StateNotifierProvider` without `.autoDispose` is a singleton for the life
/// of the app process, so switching accounts on the same device WITHOUT a
/// full app restart — sign out, then a newly-approved scholar signs in — left
/// every one of these still showing the PREVIOUS scholar's grades, attendance,
/// private messages, group chats, and disbursed-amount figures. The notifier
/// itself was never torn down and rebuilt for the new uid.
///
/// `ref.invalidate` disposes the current notifier (running its `dispose()`,
/// which cancels any live Firestore subscription still pointed at the old
/// scholar's document); the next widget that reads the provider recreates a
/// fresh instance, which re-resolves whoever is signed in now. Must run on
/// every successful login AND on logout — a provider with no current
/// listener still gets disposed by `invalidate` and rebuilt fresh on its next
/// read, so there is no "wait for a listener" ordering concern here.
///
/// Deliberately NOT included:
/// - `eventsProvider` — school-wide events, not scholar-specific.
/// - `assessmentProvider` — never auto-loads from Firestore.
/// - `requirementsProvider` (the static document-catalog `StateNotifier`) —
///   a fixed template, not scholar-specific. The actual per-scholar status
///   comes from `firestoreRequirementsListProvider` /
///   `firestoreRequirementsSummaryProvider`, both `FutureProvider`s that
///   `ref.watch(currentStudentProvider)` and so already re-run automatically.
void resetPerStudentProviders(Ref ref) {
  ref.invalidate(gradesProvider);
  ref.invalidate(attendanceProvider);
  ref.invalidate(messagingProvider);
  ref.invalidate(groupChatsProvider);
  ref.invalidate(scholarshipTimelineProvider);
  ref.invalidate(disbursementsProvider);
  // Announcement content itself is broadcast (shared across every scholar),
  // so it isn't a data leak either way — but the read/unread tracking is kept
  // in local instance state (`_readIds`/`_knownIds`), and without this reset
  // a new scholar could open the app to announcements already marked "read"
  // that they had never actually opened.
  ref.invalidate(announcementsProvider);
}
