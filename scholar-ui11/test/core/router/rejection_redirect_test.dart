import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/router/app_router.dart';

void main() {
  group('rejectionRedirectTarget', () {
    test('sends a pending rejected applicant to /rejection', () {
      final target = rejectionRedirectTarget(
        rejectionPending: true,
        isViewingRejection: false,
      );
      expect(target, '/rejection');
    });

    test('does nothing while already on /rejection and still pending', () {
      final target = rejectionRedirectTarget(
        rejectionPending: true,
        isViewingRejection: true,
      );
      expect(target, isNull);
    });

    test('bounces back to /dashboard once acknowledged but still on /rejection', () {
      final target = rejectionRedirectTarget(
        rejectionPending: false,
        isViewingRejection: true,
      );
      expect(target, '/dashboard');
    });

    test('does nothing for a normal, non-pending route', () {
      final target = rejectionRedirectTarget(
        rejectionPending: false,
        isViewingRejection: false,
      );
      expect(target, isNull);
    });
  });
}
