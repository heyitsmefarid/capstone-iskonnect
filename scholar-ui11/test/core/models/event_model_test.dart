import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/event_model.dart';

// hasEnded() is what upcomingEventsProvider uses to drop an event off the
// list once it's actually over — previously an event stayed "upcoming" for
// its whole calendar day, so a scholar could see the same event listed as
// both upcoming AND already attended in Activity History.
void main() {
  EventModel eventOn(DateTime date, {String? endTime}) => EventModel(
        id: '1',
        name: 'Orientation',
        date: date,
        schoolYear: '2026-2027',
        semester: '1st Semester',
        endTime: endTime,
      );

  test('has not ended before its end time today', () {
    final now = DateTime(2026, 8, 1, 10, 0);
    final event = eventOn(DateTime(2026, 8, 1), endTime: '11:00');
    expect(event.hasEnded(now: now), isFalse);
  });

  test('has ended once the end time on the same day has passed', () {
    final now = DateTime(2026, 8, 1, 12, 0);
    final event = eventOn(DateTime(2026, 8, 1), endTime: '11:00');
    expect(event.hasEnded(now: now), isTrue);
  });

  test('a future-dated event has not ended regardless of the clock time', () {
    final now = DateTime(2026, 8, 1, 23, 0);
    final event = eventOn(DateTime(2026, 8, 2), endTime: '09:00');
    expect(event.hasEnded(now: now), isFalse);
  });

  test('falls back to end-of-day when no end time is on file', () {
    final stillToday = DateTime(2026, 8, 1, 20, 0);
    final pastMidnight = DateTime(2026, 8, 2, 0, 1);
    final event = eventOn(DateTime(2026, 8, 1)); // no endTime

    expect(event.hasEnded(now: stillToday), isFalse);
    expect(event.hasEnded(now: pastMidnight), isTrue);
  });

  test('an empty-string end time is treated the same as missing', () {
    final event = eventOn(DateTime(2026, 8, 1), endTime: '');
    expect(event.hasEnded(now: DateTime(2026, 8, 1, 20, 0)), isFalse);
    expect(event.hasEnded(now: DateTime(2026, 8, 2, 0, 1)), isTrue);
  });

  test('a malformed end time falls back to end-of-day rather than crashing', () {
    final event = eventOn(DateTime(2026, 8, 1), endTime: 'not-a-time');
    expect(event.hasEnded(now: DateTime(2026, 8, 1, 20, 0)), isFalse);
    expect(event.hasEnded(now: DateTime(2026, 8, 2, 0, 1)), isTrue);
  });
}
