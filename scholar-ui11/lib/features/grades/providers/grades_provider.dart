import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:typed_data';
import 'package:iskonnectttt/core/models/grade_model.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';
import 'package:iskonnectttt/core/services/storage_service.dart';

/// Selected academic period for filtering
class AcademicPeriod {
  final String academicYear;
  final String semester;

  const AcademicPeriod({required this.academicYear, required this.semester});

  String get displayName => '$semester, A.Y. $academicYear';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AcademicPeriod &&
          academicYear == other.academicYear &&
          semester == other.semester;

  @override
  int get hashCode => academicYear.hashCode ^ semester.hashCode;
}

String buildAcademicPeriodKey({
  required String academicYear,
  required String semester,
}) {
  return '$academicYear::$semester';
}

class CorSubmission {
  final String academicYear;
  final String semester;
  final String fileName;
  final int fileSize;
  final String fileType;
  final String? filePath;
  final Uint8List? fileBytes;
  final String? fileUrl;
  final DateTime uploadedAt;

  const CorSubmission({
    required this.academicYear,
    required this.semester,
    required this.fileName,
    required this.fileSize,
    required this.fileType,
    this.filePath,
    this.fileBytes,
    this.fileUrl,
    required this.uploadedAt,
  });

  String get periodLabel => '$semester, A.Y. $academicYear';

  Map<String, dynamic> toMap() => {
        'academicYear': academicYear,
        'semester': semester,
        'fileName': fileName,
        'fileSize': fileSize,
        'fileType': fileType,
        'fileUrl': fileUrl,
        'uploadedAt': uploadedAt.toIso8601String(),
      };

  factory CorSubmission.fromMap(Map<String, dynamic> m) => CorSubmission(
        academicYear: m['academicYear']?.toString() ?? 'N/A',
        semester: m['semester']?.toString() ?? '',
        fileName: m['fileName']?.toString() ?? 'file',
        fileSize: m['fileSize'] is num ? (m['fileSize'] as num).toInt() : 0,
        fileType: m['fileType']?.toString() ?? 'unknown',
        fileUrl: m['fileUrl']?.toString(),
        uploadedAt: ScholarFirestoreService.parseDateTime(m['uploadedAt']),
      );
}

/// A Certificate of Grades (COG) the scholar uploads per semester. Unlike COR
/// (kept only in memory), COG is uploaded to storage and persisted to the user
/// document so the admin can view it and it survives app restarts.
class CogSubmission {
  final String academicYear;
  final String semester;
  final String fileName;
  final int fileSize;
  final String fileType;
  final String? fileUrl;
  final DateTime uploadedAt;

  const CogSubmission({
    required this.academicYear,
    required this.semester,
    required this.fileName,
    required this.fileSize,
    required this.fileType,
    this.fileUrl,
    required this.uploadedAt,
  });

  String get periodLabel => '$semester, A.Y. $academicYear';

  Map<String, dynamic> toMap() => {
        'academicYear': academicYear,
        'semester': semester,
        'fileName': fileName,
        'fileSize': fileSize,
        'fileType': fileType,
        'fileUrl': fileUrl,
        'uploadedAt': uploadedAt.toIso8601String(),
      };

  factory CogSubmission.fromMap(Map<String, dynamic> m) => CogSubmission(
        academicYear: m['academicYear']?.toString() ?? 'N/A',
        semester: m['semester']?.toString() ?? '',
        fileName: m['fileName']?.toString() ?? 'file',
        fileSize: m['fileSize'] is num ? (m['fileSize'] as num).toInt() : 0,
        fileType: m['fileType']?.toString() ?? 'unknown',
        fileUrl: m['fileUrl']?.toString(),
        uploadedAt: ScholarFirestoreService.parseDateTime(m['uploadedAt']),
      );
}

class CogSubmissionsNotifier extends StateNotifier<Map<String, CogSubmission>> {
  CogSubmissionsNotifier() : super({}) {
    _load();
  }

  /// Hydrate previously submitted COGs from the user document.
  Future<void> _load() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;
      final doc = await ScholarFirestoreService.fetchStudentDoc(studentId);
      final raw = doc?['cogSubmissions'];
      if (raw is! List) return;

      final next = <String, CogSubmission>{};
      for (final item in raw) {
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final key = m['periodKey']?.toString() ??
            buildAcademicPeriodKey(
              academicYear: m['academicYear']?.toString() ?? '',
              semester: m['semester']?.toString() ?? '',
            );
        next[key] = CogSubmission.fromMap(m);
      }
      if (next.isNotEmpty) state = next;
    } catch (_) {}
  }

  List<Map<String, dynamic>> _serialize() => state.entries
      .map((e) => {'periodKey': e.key, ...e.value.toMap()})
      .toList();

  Future<void> _persist() async {
    final studentId = await ScholarFirestoreService.currentStudentId();
    if (studentId == null) return;
    await ScholarFirestoreService.saveStudentFields(studentId, {
      'cogSubmissions': _serialize(),
    });
  }

  /// Uploads the file to storage, records it for the period, and persists to
  /// Firestore. Returns false if a file was provided but the upload failed.
  Future<bool> submitCog({
    required String academicYear,
    required String semester,
    required String fileName,
    required int fileSize,
    required String fileType,
    Uint8List? fileBytes,
  }) async {
    final key = buildAcademicPeriodKey(
      academicYear: academicYear,
      semester: semester,
    );

    String? fileUrl;
    if (fileBytes != null) {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId != null) {
        fileUrl = await StorageService.uploadRequirementFile(
          studentId: studentId,
          requirementId: 'cog_$key',
          fileName: fileName,
          bytes: fileBytes,
        );
      }
    }

    state = {
      ...state,
      key: CogSubmission(
        academicYear: academicYear,
        semester: semester,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
        fileUrl: fileUrl,
        uploadedAt: DateTime.now(),
      ),
    };

    await _persist();
    return fileBytes == null || fileUrl != null;
  }

  Future<void> removeCog({
    required String academicYear,
    required String semester,
  }) async {
    final key = buildAcademicPeriodKey(
      academicYear: academicYear,
      semester: semester,
    );
    state = Map<String, CogSubmission>.from(state)..remove(key);
    await _persist();
  }
}

class CorSubmissionsNotifier extends StateNotifier<Map<String, CorSubmission>> {
  CorSubmissionsNotifier() : super({}) {
    _load();
  }

  /// Hydrate previously submitted CORs from the user document so they remain
  /// viewable after an app restart (the uploaded file is fetched by its URL).
  Future<void> _load() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;
      final doc = await ScholarFirestoreService.fetchStudentDoc(studentId);
      final raw = doc?['corSubmissions'];
      if (raw is! List) return;

      final next = <String, CorSubmission>{};
      for (final item in raw) {
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final key = m['periodKey']?.toString() ??
            buildAcademicPeriodKey(
              academicYear: m['academicYear']?.toString() ?? '',
              semester: m['semester']?.toString() ?? '',
            );
        next[key] = CorSubmission.fromMap(m);
      }
      if (next.isNotEmpty) state = next;
    } catch (_) {}
  }

  List<Map<String, dynamic>> _serialize() => state.entries
      .map((e) => {'periodKey': e.key, ...e.value.toMap()})
      .toList();

  Future<void> _persist() async {
    final studentId = await ScholarFirestoreService.currentStudentId();
    if (studentId == null) return;
    await ScholarFirestoreService.saveStudentFields(studentId, {
      'corSubmissions': _serialize(),
    });
  }

  /// Uploads the file to storage, records it for the period, and persists to
  /// Firestore. Returns false if a file was provided but the upload failed.
  Future<bool> submitCor({
    required String academicYear,
    required String semester,
    required String fileName,
    required int fileSize,
    required String fileType,
    String? filePath,
    Uint8List? fileBytes,
  }) async {
    final key = buildAcademicPeriodKey(
      academicYear: academicYear,
      semester: semester,
    );

    String? fileUrl;
    if (fileBytes != null) {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId != null) {
        fileUrl = await StorageService.uploadRequirementFile(
          studentId: studentId,
          requirementId: 'cor_$key',
          fileName: fileName,
          bytes: fileBytes,
        );
      }
    }

    state = {
      ...state,
      key: CorSubmission(
        academicYear: academicYear,
        semester: semester,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
        filePath: filePath,
        fileBytes: fileBytes,
        fileUrl: fileUrl,
        uploadedAt: DateTime.now(),
      ),
    };

    await _persist();
    return fileBytes == null || fileUrl != null;
  }

  Future<void> removeCor({
    required String academicYear,
    required String semester,
  }) async {
    final key = buildAcademicPeriodKey(
      academicYear: academicYear,
      semester: semester,
    );
    state = Map<String, CorSubmission>.from(state)..remove(key);
    await _persist();
  }
}

/// Provider for selected academic period
final selectedPeriodProvider = StateProvider<AcademicPeriod?>((ref) => null);

/// Provider for available academic years
final availableAcademicYearsProvider = Provider<List<String>>((ref) {
  final periods = ref.watch(availablePeriodsProvider);
  final years = periods.map((period) => period.academicYear).toSet().toList()
    ..sort((a, b) => b.compareTo(a));
  return years;
});

/// Provider for available semesters
final availableSemestersProvider = Provider<List<String>>((ref) {
  return ['1st Semester', '2nd Semester'];
});

/// The active academic year + semester (set by the admin). Grades and COR are
/// auto-assigned to this period so scholars don't pick it manually.
class ActiveAcademicPeriod {
  final String schoolYear;
  final String semester;
  const ActiveAcademicPeriod(this.schoolYear, this.semester);
  String get label => '$semester, A.Y. $schoolYear';
}

String computeCurrentSchoolYear() {
  final now = DateTime.now();
  // A school year starts around June.
  return now.month >= 6
      ? '${now.year}-${now.year + 1}'
      : '${now.year - 1}-${now.year}';
}

// Live-streamed (not a one-time fetch) so a scholar already signed in sees
// the term switch — and everything keyed off it (current-term grades,
// attendance, announcements) reset — the moment the admin changes the active
// term, instead of staying locked to whatever was active when the app
// first loaded until it's restarted.
final activeAcademicPeriodProvider =
    StreamProvider<ActiveAcademicPeriod>((ref) {
  return ScholarFirestoreService.activeAcademicPeriodStream().map((cfg) {
    final sy = (cfg['schoolYear'] ?? '').isNotEmpty
        ? cfg['schoolYear']!
        : computeCurrentSchoolYear();
    final sem =
        (cfg['semester'] ?? '').isNotEmpty ? cfg['semester']! : '1st Semester';
    return ActiveAcademicPeriod(sy, sem);
  });
});

/// Grades belonging to the currently active academic period only — a
/// semester that has already ended shouldn't keep counting toward "current"
/// stats (e.g. the Dashboard's Subjects card) once a new term has started.
final currentTermGradesProvider = Provider<List<GradeModel>>((ref) {
  final allGrades = ref.watch(gradesProvider);
  final activeAsync = ref.watch(activeAcademicPeriodProvider);
  return activeAsync.maybeWhen(
    data: (active) => allGrades
        .where((g) =>
            g.academicYear == active.schoolYear && g.semester == active.semester)
        .toList(),
    orElse: () => allGrades.where((g) => !g.isGraded).toList(),
  );
});

class GradesNotifier extends StateNotifier<List<GradeModel>> {
  GradesNotifier() : super(const []) {
    _loadFromFirestore();
  }

  Future<void> _loadFromFirestore() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      // Prefer grades the admin encodes directly on the user document.
      final userDoc = await ScholarFirestoreService.fetchStudentDoc(studentId);
      final docGrades = userDoc?['grades'];
      if (docGrades is List && docGrades.isNotEmpty) {
        final grades = <GradeModel>[];
        for (final rec in docGrades) {
          if (rec is! Map) continue;
          final r = Map<String, dynamic>.from(rec);
          final semester = r['semester']?.toString() ?? 'Unknown Semester';
          final academicYear =
              (r['schoolYear'] ?? r['academicYear'])?.toString() ?? 'N/A';
          final subjects = r['subjects'];
          if (subjects is List) {
            for (final s in subjects) {
              if (s is Map) {
                grades.add(_gradeFromRecord(
                    Map<String, dynamic>.from(s), semester, academicYear));
              }
            }
          }
        }
        if (grades.isNotEmpty) {
          state = grades;
          return;
        }
      }

      final records = await ScholarFirestoreService.fetchAcademicRecords(studentId);
      if (records.isEmpty) return;

      final grades = <GradeModel>[];
      for (final record in records) {
        final semester = record['semester']?.toString() ?? 'Unknown Semester';
        final academicYear = record['academicYear']?.toString() ?? 'N/A';

        final rawGrades = record['grades'];
        if (rawGrades is List) {
          for (final item in rawGrades) {
            if (item is Map<String, dynamic>) {
              grades.add(_gradeFromRecord(item, semester, academicYear));
            } else if (item is Map) {
              grades.add(_gradeFromRecord(Map<String, dynamic>.from(item), semester, academicYear));
            }
          }
          continue;
        }

        grades.add(_gradeFromRecord(record, semester, academicYear));
      }

      if (grades.isNotEmpty) {
        state = grades;
      }
    } catch (_) {}
  }

  GradeModel _gradeFromRecord(Map<String, dynamic> record, String semester, String academicYear) {
    return GradeModel(
      id: '${record['id'] ?? record['subjectCode'] ?? record['subjectName'] ?? DateTime.now().microsecondsSinceEpoch}',
      subjectName: record['subjectName']?.toString() ?? record['name']?.toString() ?? 'Subject',
      subjectCode: record['subjectCode']?.toString() ?? record['code']?.toString() ?? 'N/A',
      semester: record['semester']?.toString() ?? semester,
      academicYear: record['academicYear']?.toString() ?? academicYear,
      units: (record['units'] is int) ? record['units'] as int : int.tryParse('${record['units'] ?? 3}') ?? 3,
      grade: record['grade'] == null ? null : double.tryParse(record['grade'].toString()),
      remarks: record['remarks']?.toString(),
    );
  }

  void addGrade(GradeModel grade) {
    state = [...state, grade];
    _syncToFirestore();
  }

  void updateGrade(GradeModel grade) {
    state = state.map((g) => g.id == grade.id ? grade : g).toList();
    _syncToFirestore();
  }

  void deleteGrade(String id) {
    state = state.where((g) => g.id != id).toList();
    _syncToFirestore();
  }

  /// Writes the scholar's grades to their user document (grouped by school year
  /// and semester) so the admin panel can fetch and display them.
  Future<void> _syncToFirestore() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      final records = <String, Map<String, dynamic>>{};
      for (final g in state) {
        final key = '${g.academicYear}::${g.semester}';
        final record = records.putIfAbsent(
          key,
          () => {
            'schoolYear': g.academicYear,
            'semester': g.semester,
            'subjects': <Map<String, dynamic>>[],
          },
        );
        (record['subjects'] as List).add({
          'name': g.subjectName,
          'code': g.subjectCode,
          'units': g.units,
          'grade': g.grade,
          'remarks': g.remarks,
        });
      }

      await ScholarFirestoreService.saveStudentFields(studentId, {
        'grades': records.values.toList(),
      });
    } catch (_) {
      // Local state already updated; ignore sync failures.
    }
  }

  List<GradeModel> getGradesBySemester(String semester, String academicYear) {
    return state
        .where((g) => g.semester == semester && g.academicYear == academicYear)
        .toList();
  }

  /// Get all unique academic periods from grades
  List<AcademicPeriod> get availablePeriods {
    final Set<AcademicPeriod> periods = {};
    for (final grade in state) {
      periods.add(
        AcademicPeriod(
          academicYear: grade.academicYear,
          semester: grade.semester,
        ),
      );
    }
    // Sort by academic year desc, then semester
    final sortedList = periods.toList()
      ..sort((a, b) {
        final yearCompare = b.academicYear.compareTo(a.academicYear);
        if (yearCompare != 0) return yearCompare;
        // Order: 1st Semester, 2nd Semester
        const semOrder = {'1st Semester': 0, '2nd Semester': 1};
        return (semOrder[a.semester] ?? 0).compareTo(semOrder[b.semester] ?? 0);
      });
    return sortedList;
  }

  Map<String, List<GradeModel>> get groupedBySemester {
    final Map<String, List<GradeModel>> grouped = {};
    for (final grade in state) {
      final key = '${grade.semester}, ${grade.academicYear}';
      grouped.putIfAbsent(key, () => []);
      grouped[key]!.add(grade);
    }
    return grouped;
  }
}

final gradesProvider = StateNotifierProvider<GradesNotifier, List<GradeModel>>((
  ref,
) {
  return GradesNotifier();
});

final corSubmissionsProvider =
    StateNotifierProvider<CorSubmissionsNotifier, Map<String, CorSubmission>>((
      ref,
    ) {
      return CorSubmissionsNotifier();
    });

final cogSubmissionsProvider =
    StateNotifierProvider<CogSubmissionsNotifier, Map<String, CogSubmission>>((
      ref,
    ) {
      return CogSubmissionsNotifier();
    });

/// Provider for filtered grades based on selected period
final filteredGradesProvider = Provider<List<GradeModel>>((ref) {
  final allGrades = ref.watch(gradesProvider);
  final selectedPeriod = ref.watch(selectedPeriodProvider);

  if (selectedPeriod == null) {
    return allGrades;
  }

  return allGrades
      .where(
        (g) =>
            g.academicYear == selectedPeriod.academicYear &&
            g.semester == selectedPeriod.semester,
      )
      .toList();
});

/// Provider for current semester grades (no grades yet)
final currentSemesterGradesProvider = Provider<List<GradeModel>>((ref) {
  final allGrades = ref.watch(gradesProvider);
  return allGrades.where((g) => !g.isGraded).toList();
});

/// Provider for past grades (already graded by admin)
final pastGradesProvider = Provider<List<GradeModel>>((ref) {
  final allGrades = ref.watch(gradesProvider);
  return allGrades.where((g) => g.isGraded).toList();
});

/// Every grade record for the selected period (all periods when none is
/// chosen), graded or not — the same set the screen actually lists.
///
/// Replaces an earlier `filteredPastGradesProvider` that applied the same
/// period filter on top of [pastGradesProvider]'s `isGraded` restriction. It
/// is gone rather than left alongside this one, so nothing can accidentally
/// reach for the graded-only variant when it means "everything enrolled".
final filteredAllGradesProvider = Provider<List<GradeModel>>((ref) {
  final allGrades = ref.watch(gradesProvider);
  final selectedPeriod = ref.watch(selectedPeriodProvider);

  if (selectedPeriod == null) return allGrades;

  return allGrades
      .where(
        (g) =>
            g.academicYear == selectedPeriod.academicYear &&
            g.semester == selectedPeriod.semester,
      )
      .toList();
});

/// Header summary for the Grades screen.
///
/// Counts every enrolled subject, not just graded ones. It previously read a
/// graded-only list, so the card reported "2 Subjects / 6 Units" while the list
/// underneath showed 3 and the dashboard's "enrolled Subjects" tile showed 3 —
/// the same subjects counted two different ways on one screen.
///
/// GWA is unaffected: [GradeSummary.fromGrades] already averages over graded
/// subjects only, which is correct — an ungraded subject has nothing to average.
final gradeSummaryProvider = Provider<GradeSummary>((ref) {
  final grades = ref.watch(filteredAllGradesProvider);
  return GradeSummary.fromGrades(grades);
});

/// Provider for overall summary (all semesters)
final overallSummaryProvider = Provider<GradeSummary>((ref) {
  final grades = ref.watch(gradesProvider);
  return GradeSummary.fromGrades(grades);
});

final gradesByAcademicYearProvider = Provider.family<List<GradeModel>, String>((
  ref,
  academicYear,
) {
  final grades = ref.watch(gradesProvider);
  return grades.where((g) => g.academicYear == academicYear).toList();
});

/// Provider for available periods from actual grades
final availablePeriodsProvider = Provider<List<AcademicPeriod>>((ref) {
  final notifier = ref.watch(gradesProvider.notifier);
  return notifier.availablePeriods;
});

/// The admin's per-semester grade confirmation, keyed by
/// `${academicYear}::${semester}`. Each value is a map like
/// `{ status: 'confirmed' | 'revision', evaluatedAt }`. A live stream so the
/// scholar sees the status flip the moment the admin confirms.
final gradesEvaluationProvider =
    StreamProvider<Map<String, dynamic>>((ref) async* {
  final studentId = await ScholarFirestoreService.currentStudentId();
  if (studentId == null) {
    yield <String, dynamic>{};
    return;
  }
  yield* ScholarFirestoreService.studentDocStream(studentId).map((doc) {
    final raw = doc?['gradesEvaluation'];
    return raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
  });
});

/// Resolves the confirmation status for a given period from the evaluation map.
/// Returns 'confirmed', 'revision', or 'pending' (the default before review).
String gradeConfirmationStatus(
  Map<String, dynamic> evaluation,
  String academicYear,
  String semester,
) {
  final entry = evaluation['$academicYear::$semester'];
  if (entry is Map) {
    final s = entry['status']?.toString();
    if (s == 'confirmed') return 'confirmed';
    if (s == 'revision') return 'revision';
  }
  return 'pending';
}
