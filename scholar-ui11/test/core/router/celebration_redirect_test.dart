import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/router/app_router.dart';

void main() {
  group('celebrationRedirectTarget', () {
    test('sends a pending scholar to /celebration', () {
      final target = celebrationRedirectTarget(celebrationPending: true, isCelebrating: false);
      expect(target, '/celebration');
    });

    test('does nothing while already on /celebration and still pending', () {
      final target = celebrationRedirectTarget(celebrationPending: true, isCelebrating: true);
      expect(target, isNull);
    });

    test('bounces back to /dashboard once acknowledged but still on /celebration', () {
      final target = celebrationRedirectTarget(celebrationPending: false, isCelebrating: true);
      expect(target, '/dashboard');
    });

    test('does nothing for a normal, non-pending route', () {
      final target = celebrationRedirectTarget(celebrationPending: false, isCelebrating: false);
      expect(target, isNull);
    });
  });
}
