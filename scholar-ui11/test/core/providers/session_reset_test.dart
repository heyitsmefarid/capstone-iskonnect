import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:iskonnectttt/features/attendance/providers/attendance_provider.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/features/messaging/providers/messaging_provider.dart';
import 'package:iskonnectttt/features/profile/providers/scholarship_timeline_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'invalidating a per-scholar provider hands back a brand new notifier, '
    'not the previous one — the mechanism resetPerStudentProviders relies on',
    () {
      // This does not call the real resetPerStudentProviders(): that function
      // also invalidates groupChatsProvider and announcementsProvider, and
      // Riverpod's invalidate() builds a provider that was never read before
      // disposing it. Both of those notifiers open a Firestore stream
      // unconditionally in their constructor — no student-id gate, no
      // try/catch — so merely invalidating them crashes without Firebase
      // initialized (confirmed while writing this test: "Bad state: Tried to
      // use GroupChatsNotifier after `dispose` was called", thrown from a
      // stream callback outside this test's control). That is a pre-existing
      // gap in those two classes, not a defect in the reset mechanism itself,
      // so this test exercises that mechanism directly against five real,
      // Firebase-tolerant providers instead of routing through the shared
      // function.
      //
      // Each of the five reads ScholarFirestoreService.currentStudentId()
      // (SharedPreferences only) first and returns before touching Firestore
      // when it's null — matching a device with no scholar signed in, and
      // keeping this test free of any Firebase test setup.
      SharedPreferences.setMockInitialValues({});

      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Force each into existence first, mirroring production: the outgoing
      // scholar's session already visited the Grades/Attendance/Messages/
      // Profile screens before a new scholar signs in on the same device.
      final beforeGrades = container.read(gradesProvider.notifier);
      final beforeAttendance = container.read(attendanceProvider.notifier);
      final beforeMessaging = container.read(messagingProvider.notifier);
      final beforeTimeline =
          container.read(scholarshipTimelineProvider.notifier);
      final beforeDisbursements =
          container.read(disbursementsProvider.notifier);

      container.invalidate(gradesProvider);
      container.invalidate(attendanceProvider);
      container.invalidate(messagingProvider);
      container.invalidate(scholarshipTimelineProvider);
      container.invalidate(disbursementsProvider);

      // This is the exact mechanism that let the previous scholar's grades,
      // attendance, private messages, timeline and disbursed amounts leak
      // into the next scholar's session: a plain (non-autoDispose)
      // StateNotifierProvider is a singleton for the life of the app process
      // until something invalidates it. Getting a different instance back
      // proves the old one — and whatever Firestore data it had cached — was
      // actually discarded, not just marked stale.
      expect(
        container.read(gradesProvider.notifier),
        isNot(same(beforeGrades)),
      );
      expect(
        container.read(attendanceProvider.notifier),
        isNot(same(beforeAttendance)),
      );
      expect(
        container.read(messagingProvider.notifier),
        isNot(same(beforeMessaging)),
      );
      expect(
        container.read(scholarshipTimelineProvider.notifier),
        isNot(same(beforeTimeline)),
      );
      expect(
        container.read(disbursementsProvider.notifier),
        isNot(same(beforeDisbursements)),
      );
    },
  );
}
