import 'package:cloud_firestore/cloud_firestore.dart';

/// Reads the `events` collection admin-ui schedules into, so this scanner
/// works from the same events the admin and scholar app see — newest/
/// upcoming first, so today's event surfaces near the top of the picker.
///
/// Only events that haven't ended yet are returned — an operator has no
/// reason to scan attendance into an event that's already over, and leaving
/// ended events in the picker made it easy to select the wrong (past) one by
/// mistake.
class EventsService {
  static Stream<List<Map<String, dynamic>>> eventsStream() {
    return FirebaseFirestore.instance
        .collection('events')
        .orderBy('date', descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .map((d) => {'id': d.id, ...d.data()})
              .where((record) => !hasEventEnded(record))
              .toList(),
        );
  }

  /// Whether an event's end time has already passed. Mirrors admin-ui's own
  /// hasEventEnded (Attendance.jsx) and the scholar app's EventModel.hasEnded
  /// — same end-of-day fallback for an event with no end time on file, so all
  /// three apps agree on when an event is "over".
  static bool hasEventEnded(Map<String, dynamic> record, {DateTime? now}) {
    final date = _parseDate(record['date']);
    if (date == null) return false;

    final endTime = record['endTime']?.toString();
    int hour = 23;
    int minute = 59;
    if (endTime != null && endTime.isNotEmpty) {
      final parts = endTime.split(':');
      hour = int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 23;
      minute = int.tryParse(parts.length > 1 ? parts[1] : '') ?? 59;
    }
    final endDateTime =
        DateTime(date.year, date.month, date.day, hour, minute);
    return (now ?? DateTime.now()).isAfter(endDateTime);
  }

  static DateTime? _parseDate(dynamic value) {
    if (value is String) return DateTime.tryParse(value);
    if (value is Timestamp) return value.toDate();
    return null;
  }
}
