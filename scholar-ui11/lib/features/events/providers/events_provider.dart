import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/event_model.dart';
import 'package:iskonnectttt/core/services/event_reminder_service.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart'
    show activeAcademicPeriodProvider;

class EventsNotifier extends StateNotifier<List<EventModel>> {
  EventsNotifier() : super(const []) {
    _subscribe();
  }

  StreamSubscription<List<Map<String, dynamic>>>? _subscription;

  void _subscribe() {
    _subscription = ScholarFirestoreService.eventsStream().listen((records) {
      state = records.map(_mapRecord).toList();
      final upcoming = state.where((e) => !_isPast(e.date)).toList();
      EventReminderService.scheduleReminders(upcoming);
    });
  }

  EventModel _mapRecord(Map<String, dynamic> record) {
    return EventModel(
      id: record['id']?.toString() ?? '',
      name: record['name']?.toString() ?? 'Event',
      date: _parseDate(record['date']),
      required: record['required'] == true,
      schoolYear: record['schoolYear']?.toString() ?? '',
      semester: record['semester']?.toString() ?? '',
      endTime: record['endTime']?.toString(),
    );
  }

  DateTime _parseDate(dynamic value) {
    final parsed = ScholarFirestoreService.parseDateTime(value);
    return parsed.year == 1970 ? DateTime.now() : parsed;
  }

  bool _isPast(DateTime date) {
    final today = DateTime.now();
    final dayOnly = DateTime(today.year, today.month, today.day);
    final eventDayOnly = DateTime(date.year, date.month, date.day);
    return eventDayOnly.isBefore(dayOnly);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

final eventsProvider = StateNotifierProvider<EventsNotifier, List<EventModel>>((
  ref,
) {
  return EventsNotifier();
});

/// Events for the currently active term whose end time hasn't passed yet,
/// soonest first (the query already orders by date ascending).
///
/// Scoped to the active term so this resets the moment a new semester
/// starts, instead of carrying forward events from a term that's already
/// over. And scoped by end time (not just calendar date) so an event drops
/// off the list the moment it's actually finished — previously an event
/// stayed "upcoming" for its entire calendar day even after ending and even
/// after the scholar had already been marked present for it.
final upcomingEventsProvider = Provider<List<EventModel>>((ref) {
  final events = ref.watch(eventsProvider);
  final activeAsync = ref.watch(activeAcademicPeriodProvider);
  return activeAsync.maybeWhen(
    data: (active) => events
        .where((e) =>
            e.schoolYear == active.schoolYear &&
            e.semester == active.semester &&
            !e.hasEnded())
        .toList(),
    orElse: () => const [],
  );
});
