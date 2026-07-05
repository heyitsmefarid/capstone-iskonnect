import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../config/firebase_config.dart';
import 'storage_service.dart';
import 'connectivity_service.dart';

/// Result of a sync operation
class SyncResult {
  final bool success;
  final int syncedCount;
  final String? errorMessage;
  final DateTime timestamp;

  SyncResult({
    required this.success,
    required this.syncedCount,
    this.errorMessage,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  @override
  String toString() {
    if (success) {
      return 'Synced $syncedCount records successfully';
    }
    return 'Sync failed: $errorMessage';
  }
}

/// Service for syncing local attendance data to the backend API.
/// Handles automatic sync when online and manual sync requests.
class SyncService extends ChangeNotifier {
  // Singleton pattern
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  final StorageService _storageService = StorageService();
  final ConnectivityService _connectivityService = ConnectivityService();

  Timer? _autoSyncTimer;
  bool _isSyncing = false;
  SyncResult? _lastSyncResult;
  DateTime? _lastSyncAttempt;

  // Auto-sync interval (check every 30 seconds when online)
  static const Duration _syncInterval = Duration(seconds: 30);

  // Don't let two sync triggers (timer, connectivity flap, post-scan) fire
  // back-to-back — connectivity_plus is known to flap on web.
  static const Duration _minRetryGap = Duration(seconds: 5);

  // Give up on a record that can't resolve to a scholar after this many
  // attempts, instead of re-writing an audit log entry for it every 30
  // seconds forever (this is what was exhausting the Firestore write quota).
  static const int _maxSyncAttempts = 10;

  /// Whether sync is in progress
  bool get isSyncing => _isSyncing;

  /// Last sync result
  SyncResult? get lastSyncResult => _lastSyncResult;

  /// Last sync attempt time
  DateTime? get lastSyncAttempt => _lastSyncAttempt;

  /// Number of records pending sync
  int get pendingCount => _storageService.getUnsyncedCount();

  /// Initialize the sync service
  Future<void> initialize() async {
    // Listen for connectivity changes
    _connectivityService.addListener(_onConnectivityChange);

    // Start auto-sync timer if enabled
    if (_storageService.isAutoSyncEnabled()) {
      _startAutoSyncTimer();
      // Flush anything queued from a previous session right away.
      unawaited(syncNow());
    }
  }

  /// Handle connectivity changes
  void _onConnectivityChange() {
    if (!_connectivityService.isOnline || !_storageService.isAutoSyncEnabled()) {
      return;
    }
    // connectivity_plus is known to flap rapidly on web even with a working
    // connection — without this guard, every flap re-triggers a full sync
    // pass over all pending records.
    final lastAttempt = _lastSyncAttempt;
    if (lastAttempt != null && DateTime.now().difference(lastAttempt) < _minRetryGap) {
      return;
    }
    syncNow();
  }

  /// Start the auto-sync timer. Attempts a sync on every tick regardless of the
  /// connectivity flag (Firestore decides if the write goes through); records
  /// that fail stay queued for the next tick.
  void _startAutoSyncTimer() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(_syncInterval, (_) {
      if (!_isSyncing && pendingCount > 0) {
        syncNow();
      }
    });
  }

  /// Stop the auto-sync timer
  void _stopAutoSyncTimer() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = null;
  }

  /// Enable or disable auto-sync
  Future<void> setAutoSync(bool enabled) async {
    await _storageService.setAutoSync(enabled);
    if (enabled) {
      _startAutoSyncTimer();
    } else {
      _stopAutoSyncTimer();
    }
    notifyListeners();
  }

  /// Sync all pending records to the backend
  Future<SyncResult> syncNow() async {
    // Prevent concurrent syncs
    if (_isSyncing) {
      return SyncResult(
        success: false,
        syncedCount: 0,
        errorMessage: 'Sync already in progress',
      );
    }

    // NOTE: We intentionally do NOT hard-gate on connectivity_plus here.
    // On web it frequently reports "offline" even with a working connection,
    // which would leave records stuck Pending forever. Instead we attempt the
    // Firestore write and let it succeed (online) or throw (offline) — failures
    // simply stay queued for the next attempt (true offline-first behaviour).

    _isSyncing = true;
    _lastSyncAttempt = DateTime.now();
    _connectivityService.setSyncing(true);
    notifyListeners();

    try {
      // Get unsynced records
      final unsyncedRecords = _storageService.getUnsyncedRecords();

      if (unsyncedRecords.isEmpty) {
        _lastSyncResult = SyncResult(success: true, syncedCount: 0);
        return _lastSyncResult!;
      }

      // Sync records to backend
      final syncedIds = await _syncRecordsToBackend(unsyncedRecords);

      // Mark synced records
      await _storageService.markRecordsAsSynced(syncedIds);

      _lastSyncResult = SyncResult(
        success: true,
        syncedCount: syncedIds.length,
      );

      return _lastSyncResult!;
    } catch (e) {
      _lastSyncResult = SyncResult(
        success: false,
        syncedCount: 0,
        errorMessage: e.toString(),
      );
      return _lastSyncResult!;
    } finally {
      _isSyncing = false;
      _connectivityService.setSyncing(false);
      notifyListeners();
    }
  }

  /// Sync records to Firestore (the shared backend the admin + scholar apps
  /// read). Each scan is appended to the scholar's `users/{id}.attendance`
  /// array — the primary source both apps already display — and mirrored to the
  /// `attendance_logs` collection for auditing. Only records that write
  /// successfully are returned so they can be marked synced; failures stay
  /// queued for the next online attempt (offline-first).
  Future<List<String>> _syncRecordsToBackend(
    List<AttendanceRecord> records,
  ) async {
    if (!FirebaseConfig.isConfigured || Firebase.apps.isEmpty) {
      throw Exception('Firebase not configured; cannot sync.');
    }

    final db = FirebaseFirestore.instance;
    final adminId = _storageService.getCurrentAdminId() ?? 'qr_scanner';
    final syncedIds = <String>[];

    for (final record in records) {
      final scholarId = record.studentId;
      if (scholarId.isEmpty) {
        // Nothing to link to — skip but mark synced so it doesn't retry forever.
        syncedIds.add(record.id);
        continue;
      }

      final scannedAtIso = record.scanDateTime.toIso8601String();

      try {
        // 1. Audit log / scholar-app fallback lookup (any id, never creates a
        //    bogus user doc). Keyed by the local record id so a retry
        //    overwrites the same doc instead of creating a new one each time.
        await db.collection('attendance_logs').doc(record.id).set({
          'userId': scholarId,
          'scholarId': scholarId,
          'eventName': record.eventName,
          'activityName': record.eventName,
          'status': 'present',
          'present': true,
          'attendedAt': scannedAtIso,
          'date': scannedAtIso,
          'markedVia': 'qr_scanner',
          'scannedBy': adminId,
          'studentName': record.studentName,
          'school': record.schoolName,
          'program': record.programName,
          'localId': record.id,
          'createdAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true)).timeout(const Duration(seconds: 12));

        // 2. Append to the scholar's user document attendance array — the
        //    primary source the admin evaluation and scholar dashboard read.
        //    Resolve the doc by id first; if the QR carried the admin scholarId
        //    instead, fall back to a lookup. Never create a junk user doc.
        final userRef = await _resolveUserRef(db, scholarId);
        if (userRef == null) {
          // No matching scholar to attribute this scan to yet. The audit log
          // entry above is written, but the scholar's own `attendance` array
          // — what absence/termination logic actually reads — never got the
          // entry. Retry a bounded number of times (in case the scholar
          // record shows up shortly); after that, give up instead of
          // re-attempting — and re-billing a Firestore write for — this scan
          // every 30 seconds forever.
          final attempts = await _storageService.incrementSyncAttempts(record.id);
          if (attempts >= _maxSyncAttempts) {
            await _storageService.giveUpOnRecord(
              record.id,
              reason: 'No scholar found for id "$scholarId" after $attempts attempts',
            );
            if (kDebugMode) {
              print('Giving up on record ${record.id}: no scholar found for id "$scholarId".');
            }
          } else if (kDebugMode) {
            print('No scholar found for id "$scholarId" — will retry sync ($attempts/$_maxSyncAttempts).');
          }
          continue;
        }

        await userRef.set({
          'attendance': FieldValue.arrayUnion([
            {
              'activity': record.eventName,
              'eventName': record.eventName,
              'present': true,
              'status': 'present',
              'date': scannedAtIso,
              'markedVia': 'qr_scanner',
            }
          ]),
        }, SetOptions(merge: true)).timeout(const Duration(seconds: 12));

        syncedIds.add(record.id);
      } catch (e) {
        if (kDebugMode) {
          print('Firestore sync failed for record ${record.id}: $e');
        }
        // Leave this record unsynced; it retries on the next sync cycle.
      }
    }

    if (syncedIds.isEmpty && records.isNotEmpty) {
      throw Exception('No records could be synced to Firestore.');
    }

    return syncedIds;
  }

  /// Resolves the scholar's `users` document. Tries the doc id first (the QR
  /// embeds the user doc id), then falls back to matching the `scholarId` field
  /// so a scan still links even if the QR carried the admin scholarId. Returns
  /// null when no existing scholar matches (so we never create a junk user doc).
  Future<DocumentReference<Map<String, dynamic>>?> _resolveUserRef(
    FirebaseFirestore db,
    String id,
  ) async {
    final byId = db.collection('users').doc(id);
    final snap = await byId.get().timeout(const Duration(seconds: 12));
    if (snap.exists) return byId;

    final byScholarId = await db
        .collection('users')
        .where('scholarId', isEqualTo: id)
        .limit(1)
        .get()
        .timeout(const Duration(seconds: 12));
    if (byScholarId.docs.isNotEmpty) {
      return byScholarId.docs.first.reference;
    }
    return null;
  }

  /// Get sync status summary
  String getSyncStatusSummary() {
    final pending = pendingCount;
    if (_isSyncing) {
      return 'Syncing...';
    }
    if (pending == 0) {
      return 'All synced';
    }
    return '$pending pending';
  }

  /// Dispose of resources
  @override
  void dispose() {
    _autoSyncTimer?.cancel();
    _connectivityService.removeListener(_onConnectivityChange);
    super.dispose();
  }
}
