import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/announcement_model.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:uuid/uuid.dart';

class AnnouncementsNotifier extends StateNotifier<List<AnnouncementModel>> {
  AnnouncementsNotifier() : super(const []) {
    _subscribe();
  }

  StreamSubscription<List<Map<String, dynamic>>>? _subscription;

  // Read-state is tracked locally (the admin docs don't carry per-user read
  // flags), so we remember which ids the user has opened and re-apply that as
  // live updates stream in.
  final Set<String> _readIds = {};

  void _subscribe() {
    _subscription =
        ScholarFirestoreService.announcementsStream().listen((records) {
      state = records.map(_mapRecord).toList();
    });
  }

  AnnouncementModel _mapRecord(Map<String, dynamic> record) {
    final id = record['id']?.toString() ?? const Uuid().v4();
    return AnnouncementModel(
      id: id,
      title: record['title']?.toString() ?? 'Announcement',
      // Admin writes the body as `message`; keep older field names as fallback.
      description: record['message']?.toString() ??
          record['description']?.toString() ??
          record['content']?.toString() ??
          '',
      date: _parseDate(record['date']),
      imageUrl: record['imageUrl']?.toString(),
      attachments: List<String>.from(record['attachments'] ?? const []),
      isImportant: record['isImportant'] ?? false,
      isRead: _readIds.contains(id),
      // Admin writes the audience as `target` (everyone/applicants/scholars).
      visibility: _parseVisibility(record['target'] ?? record['visibility']),
    );
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  DateTime _parseDate(dynamic value) {
    final parsed = ScholarFirestoreService.parseDateTime(value);
    return parsed.year == 1970 ? DateTime.now() : parsed;
  }

  AnnouncementVisibility _parseVisibility(dynamic value) {
    final stringValue = value?.toString().toLowerCase();
    // Map the admin's `target` values to the app's visibility enum.
    switch (stringValue) {
      case 'everyone':
      case 'all':
        return AnnouncementVisibility.all;
      case 'scholars':
      case 'scholarsonly':
        return AnnouncementVisibility.scholarsOnly;
      case 'applicants':
      case 'applicantsonly':
        return AnnouncementVisibility.applicantsOnly;
    }
    return AnnouncementVisibility.values.firstWhere(
      (visibility) => visibility.name.toLowerCase() == stringValue,
      orElse: () => AnnouncementVisibility.all,
    );
  }

  void markAsRead(String id) {
    _readIds.add(id);
    state = state.map((a) {
      if (a.id == id) {
        return a.copyWith(isRead: true);
      }
      return a;
    }).toList();
  }

  void markAllAsRead() {
    _readIds.addAll(state.map((a) => a.id));
    state = state.map((a) => a.copyWith(isRead: true)).toList();
  }

  int get unreadCount => state.where((a) => !a.isRead).length;

  /// Get unread count filtered by student type
  int getUnreadCountForStudent(StudentType studentType) {
    return getAnnouncementsForStudent(
      studentType,
    ).where((a) => !a.isRead).length;
  }

  /// Filter announcements based on student type
  List<AnnouncementModel> getAnnouncementsForStudent(StudentType studentType) {
    return state.where((a) {
      if (a.visibility == AnnouncementVisibility.all) return true;
      if (studentType == StudentType.scholar) {
        return a.visibility == AnnouncementVisibility.scholarsOnly;
      } else {
        return a.visibility == AnnouncementVisibility.applicantsOnly;
      }
    }).toList();
  }
}

final announcementsProvider =
    StateNotifierProvider<AnnouncementsNotifier, List<AnnouncementModel>>((
      ref,
    ) {
      return AnnouncementsNotifier();
    });

/// Provider that returns filtered announcements based on current user type.
/// Watches the announcements *state* (not just the notifier) so it recomputes
/// as live updates stream in.
final filteredAnnouncementsProvider = Provider<List<AnnouncementModel>>((ref) {
  ref.watch(announcementsProvider);
  final student = ref.watch(currentStudentProvider);
  final notifier = ref.read(announcementsProvider.notifier);

  if (student == null) return [];
  return notifier.getAnnouncementsForStudent(student.studentType);
});

/// Provider for unread count based on current user type. Watches the
/// announcements state so the badge updates live.
final unreadAnnouncementsCountProvider = Provider<int>((ref) {
  ref.watch(announcementsProvider);
  final student = ref.watch(currentStudentProvider);
  final notifier = ref.read(announcementsProvider.notifier);

  if (student == null) return 0;
  return notifier.getUnreadCountForStudent(student.studentType);
});

final announcementByIdProvider = Provider.family<AnnouncementModel?, String>((
  ref,
  id,
) {
  final announcements = ref.watch(announcementsProvider);
  return announcements.where((a) => a.id == id).firstOrNull;
});
