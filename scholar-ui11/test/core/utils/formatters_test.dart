import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/utils/formatters.dart';

// Every case builds its input with DateTime.utc(...), so these assertions hold
// regardless of the timezone the test machine is set to.
void main() {
  group('Asia/Manila rendering', () {
    test('renders a UTC timestamp as Manila time, not UTC', () {
      // The reported bug: an announcement posted 11:54 AM Manila is stored as
      // 03:54Z and was being displayed verbatim as 3:54 AM.
      final posted = DateTime.utc(2026, 7, 30, 3, 54);

      expect(Formatters.formatTime(posted), '11:54 AM');
      expect(Formatters.formatFullDate(posted), 'Thursday, July 30, 2026');
      expect(Formatters.formatDateTime(posted), 'July 30, 2026 11:54 AM');
    });

    test('advances the calendar day when Manila is already past midnight', () {
      // 20:00Z is 04:00 the following morning in Manila. Formatting the raw UTC
      // value would report both the wrong time and the wrong date.
      final posted = DateTime.utc(2026, 7, 29, 20, 0);

      expect(Formatters.formatTime(posted), '4:00 AM');
      expect(Formatters.formatDate(posted), 'July 30, 2026');
      expect(Formatters.formatDateShort(posted), 'Jul 30, 2026');
      expect(Formatters.formatDateNumeric(posted), '07/30/2026');
      expect(Formatters.formatFullDate(posted), 'Thursday, July 30, 2026');
    });

    test('midday UTC stays on the same Manila day', () {
      final posted = DateTime.utc(2026, 7, 30, 10, 15);

      expect(Formatters.formatTime(posted), '6:15 PM');
      expect(Formatters.formatDate(posted), 'July 30, 2026');
    });
  });

  group('formatRelativeTime', () {
    test('measures elapsed time in UTC, so the offset cannot skew it', () {
      // A timestamp two hours old must read as 2 hours, not 6 or 10 — which is
      // what mixing a local `now` with a UTC timestamp would produce.
      final twoHoursAgo = DateTime.now().toUtc().subtract(const Duration(hours: 2));

      expect(Formatters.formatRelativeTime(twoHoursAgo), '2 hour(s) ago');
    });

    test('reports a just-created timestamp as Just now', () {
      expect(Formatters.formatRelativeTime(DateTime.now().toUtc()), 'Just now');
    });
  });
}
