class EventModel {
  final String id;
  final String name;
  final DateTime date;
  final bool required;
  final String schoolYear;
  final String semester;
  // 24-hour "HH:mm", e.g. "11:00" — when the event actually ends, so
  // upcomingEventsProvider can drop it the moment it's over instead of
  // keeping it listed for the rest of its calendar day.
  final String? endTime;

  const EventModel({
    required this.id,
    required this.name,
    required this.date,
    this.required = false,
    this.schoolYear = '',
    this.semester = '',
    this.endTime,
  });

  /// Whether this event's end time has already passed. Falls back to
  /// end-of-day when no end time is on file, mirroring the admin side's
  /// hasEventEnded (Attendance.jsx) — an event created before this field
  /// existed still needs the full day to pass rather than disappearing the
  /// instant "now" ticks past midnight-relative comparisons.
  bool hasEnded({DateTime? now}) {
    final t = endTime;
    int hour = 23;
    int minute = 59;
    if (t != null && t.isNotEmpty) {
      final parts = t.split(':');
      hour = int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 23;
      minute = int.tryParse(parts.length > 1 ? parts[1] : '') ?? 59;
    }
    final endDateTime = DateTime(date.year, date.month, date.day, hour, minute);
    return (now ?? DateTime.now()).isAfter(endDateTime);
  }
}
