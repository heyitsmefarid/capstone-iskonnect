import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:iskonnectttt/core/constants/firebase_env.dart';

class ScholarFirestoreService {
  const ScholarFirestoreService._();

  static bool get isReady => FirebaseEnv.isConfigured && Firebase.apps.isNotEmpty;

  /// Ensures anonymous sign-in is complete before any Firestore operation.
  /// Without this every call fails with permission-denied when auth is slow.
  static Future<void> _ensureAuth() async {
    if (!isReady) return;
    try {
      if (FirebaseAuth.instance.currentUser == null) {
        await FirebaseAuth.instance.signInAnonymously()
            .timeout(const Duration(seconds: 8));
      }
    } catch (_) {}
  }

  static FirebaseFirestore? get _firestore {
    if (!isReady) return null;
    return FirebaseFirestore.instance;
  }

  static Future<String?> currentStudentId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('logged_in_student_id');
  }

  static Future<Map<String, dynamic>?> fetchStudentDoc(String studentId) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return null;
    try {
      final snapshot = await firestore
          .collection('users')
          .doc(studentId)
          .get()
          .timeout(const Duration(seconds: 10));
      return snapshot.data();
    } catch (_) {
      return null;
    }
  }

  /// Live stream of the student's user document. Emits whenever the doc changes
  /// (e.g. the QR scanner appends attendance, or the admin edits records), so
  /// screens can fetch updates without a manual refresh.
  static Stream<Map<String, dynamic>?> studentDocStream(String studentId) {
    if (!isReady) return const Stream.empty();
    return FirebaseFirestore.instance
        .collection('users')
        .doc(studentId)
        .snapshots()
        .map((snap) => snap.data());
  }

  /// Merges [data] into the student's user document.
  static Future<void> saveStudentFields(
    String studentId,
    Map<String, dynamic> data,
  ) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return;
    try {
      await firestore
          .collection('users')
          .doc(studentId)
          .set(data, SetOptions(merge: true))
          .timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

  /// Reads the active academic year + semester set by the admin.
  static Future<Map<String, String>> fetchActiveAcademicPeriod() async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return {};
    try {
      final snap = await firestore
          .collection('system_config')
          .doc('academic')
          .get()
          .timeout(const Duration(seconds: 8));
      final data = snap.data();
      if (data == null) return {};
      return {
        'schoolYear': data['activeSchoolYear']?.toString() ?? '',
        'semester': data['activeSemester']?.toString() ?? '',
      };
    } catch (_) {
      return {};
    }
  }

  static Future<List<Map<String, dynamic>>> fetchAttendanceLogs(String studentId) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return [];
    try {
      final byUserId = await firestore
          .collection('attendance_logs')
          .where('userId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));

      final byScholarId = await firestore
          .collection('attendance_logs')
          .where('scholarId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));

      final results = <String, Map<String, dynamic>>{};
      for (final doc in [...byUserId.docs, ...byScholarId.docs]) {
        results[doc.id] = doc.data();
      }
      return results.values.toList();
    } catch (_) {
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> fetchAcademicRecords(String studentId) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return [];
    try {
      final byUserId = await firestore
          .collection('academic_records')
          .where('userId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));

      final byScholarId = await firestore
          .collection('academic_records')
          .where('scholarId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));

      final results = <String, Map<String, dynamic>>{};
      for (final doc in [...byUserId.docs, ...byScholarId.docs]) {
        results[doc.id] = doc.data();
      }
      return results.values.toList();
    } catch (_) {
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> fetchTimelineEntries(String studentId) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return [];
    try {
      final snapshot = await firestore
          .collection('timeline_entries')
          .where('userId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));

      final docs = snapshot.docs.map((doc) => doc.data()).toList();
      docs.sort((a, b) {
        final aDate = _toDateTime(a['createdAt']);
        final bDate = _toDateTime(b['createdAt']);
        return aDate.compareTo(bDate);
      });
      return docs;
    } catch (_) {
      return [];
    }
  }

  static Future<List<Map<String, dynamic>>> fetchAnnouncements() async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return [];
    try {
      final snapshot = await firestore
          .collection('announcements')
          .orderBy('date', descending: true)
          .get()
          .timeout(const Duration(seconds: 10));
      return snapshot.docs.map((doc) => {'id': doc.id, ...doc.data()}).toList();
    } catch (_) {
      return [];
    }
  }

  /// Live stream of announcements (admin writes, scholar app reads) so newly
  /// posted announcements appear without restarting the app. Each record
  /// carries the Firestore doc `id` so read-state can be tracked per item.
  static Stream<List<Map<String, dynamic>>> announcementsStream() async* {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) {
      yield const [];
      return;
    }
    yield* firestore
        .collection('announcements')
        .orderBy('date', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((d) => {'id': d.id, ...d.data()}).toList());
  }

  static Future<List<Map<String, dynamic>>> fetchMessages(String studentId) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return [];
    try {
      final sent = await firestore
          .collection('messages')
          .where('fromUserId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));
      final received = await firestore
          .collection('messages')
          .where('toUserId', isEqualTo: studentId)
          .get()
          .timeout(const Duration(seconds: 10));

      final results = <String, Map<String, dynamic>>{};
      for (final doc in [...sent.docs, ...received.docs]) {
        results[doc.id] = doc.data();
      }
      final messages = results.values.toList();
      messages.sort((a, b) =>
          _toDateTime(a['createdAt']).compareTo(_toDateTime(b['createdAt'])));
      return messages;
    } catch (_) {
      return [];
    }
  }

  static Future<void> sendMessage({
    required String fromUserId,
    required String toUserId,
    required String body,
    String? subject,
  }) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return;
    try {
      await firestore.collection('messages').add({
        'fromUserId': fromUserId,
        'toUserId': toUserId,
        'subject': subject ?? 'New Message',
        'body': body,
        'createdAt': DateTime.now().toIso8601String(),
        'readBy': [fromUserId],
      }).timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

  /// Live stream of group chats (admin writes, scholar app reads/writes) so new
  /// groups and messages appear without restarting the app. Each record carries
  /// the Firestore doc `id`; previously this was dropped, leaving every group's
  /// id null and silently emptying the scholar's list.
  static Stream<List<Map<String, dynamic>>> groupChatsStream() async* {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) {
      yield const [];
      return;
    }
    yield* firestore
        .collection('group_chats')
        .snapshots()
        .map((snap) => snap.docs.map((d) => {'id': d.id, ...d.data()}).toList());
  }

  /// Appends a message to a group's `messages` array field, matching the exact
  /// shape the admin UI writes and reads: { id, sender, senderId, text, timestamp }.
  static Future<void> sendGroupMessage({
    required String groupId,
    required String messageId,
    required String sender,
    required String senderId,
    required String text,
    required String timestamp,
  }) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null) return;
    try {
      await firestore.collection('group_chats').doc(groupId).update({
        'messages': FieldValue.arrayUnion([
          {
            'id': messageId,
            'sender': sender,
            'senderId': senderId,
            'text': text,
            'timestamp': timestamp,
          },
        ]),
      }).timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

  /// Resolves display data for a set of `users` doc ids. Used to render group
  /// member names/school/program from the ids the admin stores in `memberIds`.
  static Future<Map<String, Map<String, dynamic>>> fetchUsersByIds(
    List<String> ids,
  ) async {
    await _ensureAuth();
    final firestore = _firestore;
    if (firestore == null || ids.isEmpty) return {};
    final result = <String, Map<String, dynamic>>{};
    try {
      // whereIn on document id is capped at 10 ids per query.
      for (var i = 0; i < ids.length; i += 10) {
        final chunk = ids.sublist(i, i + 10 > ids.length ? ids.length : i + 10);
        final snap = await firestore
            .collection('users')
            .where(FieldPath.documentId, whereIn: chunk)
            .get()
            .timeout(const Duration(seconds: 10));
        for (final doc in snap.docs) {
          result[doc.id] = doc.data();
        }
      }
    } catch (_) {}
    return result;
  }

  static Future<List<String>> fetchSchools() async {
    await _ensureAuth();
    try {
      final firestore = FirebaseFirestore.instance;
      final snap = await firestore
          .collection('schools')
          .orderBy('order')
          .get()
          .timeout(const Duration(seconds: 10))
          .catchError((_) => firestore.collection('schools').get());
      return snap.docs
          .map((d) => d.data()['name']?.toString() ?? '')
          .where((n) => n.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<List<String>> fetchPrograms() async {
    await _ensureAuth();
    try {
      final firestore = FirebaseFirestore.instance;
      final snap = await firestore
          .collection('programs')
          .orderBy('order')
          .get()
          .timeout(const Duration(seconds: 10))
          .catchError((_) => firestore.collection('programs').get());
      return snap.docs
          .map((d) => d.data()['name']?.toString() ?? '')
          .where((n) => n.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  // Programs grouped by the school they belong to, so registration can show
  // only the programs offered by the selected school.
  static Future<Map<String, List<String>>> fetchProgramsBySchool() async {
    await _ensureAuth();
    try {
      final firestore = FirebaseFirestore.instance;
      final snap = await firestore
          .collection('programs')
          .orderBy('order')
          .get()
          .timeout(const Duration(seconds: 10))
          .catchError((_) => firestore.collection('programs').get());
      final map = <String, List<String>>{};
      for (final d in snap.docs) {
        final data = d.data();
        final name = data['name']?.toString() ?? '';
        final school = data['school']?.toString() ?? '';
        if (name.isEmpty || school.isEmpty) continue;
        (map[school] ??= []).add(name);
      }
      return map;
    } catch (_) {
      return {};
    }
  }

  static DateTime parseDateTime(dynamic value) {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }
    return DateTime.fromMillisecondsSinceEpoch(0);
  }

  static DateTime _toDateTime(dynamic value) => parseDateTime(value);
}
