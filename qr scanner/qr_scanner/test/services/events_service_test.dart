import 'package:flutter_test/flutter_test.dart';
import 'package:qr_scanner/services/events_service.dart';

// hasEventEnded() is what eventsStream() filters the picker with — an
// operator should never be able to select an event that's already over.
// Mirrors admin-ui's hasEventEnded (Attendance.jsx) and the scholar app's
// EventModel.hasEnded(), so all three apps agree on when an event is "over".
void main() {
  Map<String, dynamic> recordOn(String date, {String? endTime}) => {
        'name': 'Orientation',
        'date': date,
        if (endTime != null) 'endTime': endTime,
      };

  test('has not ended before its end time today', () {
    final now = DateTime(2026, 8, 1, 10, 0);
    final record = recordOn('2026-08-01', endTime: '11:00');
    expect(EventsService.hasEventEnded(record, now: now), isFalse);
  });

  test('has ended once the end time on the same day has passed', () {
    final now = DateTime(2026, 8, 1, 12, 0);
    final record = recordOn('2026-08-01', endTime: '11:00');
    expect(EventsService.hasEventEnded(record, now: now), isTrue);
  });

  test('a future-dated event has not ended regardless of the clock time', () {
    final now = DateTime(2026, 8, 1, 23, 0);
    final record = recordOn('2026-08-02', endTime: '09:00');
    expect(EventsService.hasEventEnded(record, now: now), isFalse);
  });

  test('falls back to end-of-day when no end time is on file', () {
    final stillToday = DateTime(2026, 8, 1, 20, 0);
    final pastMidnight = DateTime(2026, 8, 2, 0, 1);
    final record = recordOn('2026-08-01'); // no endTime

    expect(EventsService.hasEventEnded(record, now: stillToday), isFalse);
    expect(EventsService.hasEventEnded(record, now: pastMidnight), isTrue);
  });

  test('an empty-string end time is treated the same as missing', () {
    final record = recordOn('2026-08-01', endTime: '');
    expect(
      EventsService.hasEventEnded(record, now: DateTime(2026, 8, 1, 20, 0)),
      isFalse,
    );
    expect(
      EventsService.hasEventEnded(record, now: DateTime(2026, 8, 2, 0, 1)),
      isTrue,
    );
  });

  test('an unparseable date is never treated as ended', () {
    final record = {'name': 'Orientation', 'date': 'not-a-date'};
    expect(EventsService.hasEventEnded(record), isFalse);
  });
}
