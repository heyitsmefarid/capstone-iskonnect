import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/scholarship_timeline_model.dart';
import 'package:iskonnectttt/features/profile/providers/scholarship_timeline_provider.dart';

// "Total Scholarship Received" was undercounting for any scholar granted
// more than one semester: the admin side (AppContext.jsx's
// grantSemesterIfNeeded) appends one entry to `enrolledSemesters` per granted
// term, but the app's dashboard/profile/timeline screens only ever showed
// the latest snapshot the notifier happened to load once at construction.
// These tests pin the actual money-summing logic against the real
// `enrolledSemesters` shape written by the admin side.
void main() {
  double totalDisbursed(List<ScholarshipDisbursement>? mapped) {
    if (mapped == null) return 0;
    return mapped
        .where((d) => d.status == 'disbursed')
        .fold<double>(0, (sum, d) => sum + d.amount);
  }

  test('sums every granted semester, not just the most recent one', () {
    final doc = {
      'academicYear': '2026-2027',
      'enrolledSemesters': [
        {
          'schoolYear': '2026-2027',
          'semester': '1st Semester',
          'grantedAmount': 25000,
          'status': 'disbursed',
          'enrolledAt': '2026-07-31T20:18:47.781Z',
        },
        {
          'schoolYear': '2026-2027',
          'semester': '2nd Semester',
          'grantedAmount': 25000,
          'status': 'disbursed',
          'enrolledAt': '2026-07-31T21:00:04.959Z',
        },
      ],
    };

    final mapped = mapEnrolledSemestersToDisbursements(doc);

    expect(mapped, hasLength(2));
    expect(totalDisbursed(mapped), 50000);
  });

  test('one granted semester sums to just that one grant', () {
    final doc = {
      'academicYear': '2026-2027',
      'enrolledSemesters': [
        {
          'schoolYear': '2026-2027',
          'semester': '1st Semester',
          'grantedAmount': 25000,
          'status': 'disbursed',
          'enrolledAt': '2026-07-31T20:18:47.781Z',
        },
      ],
    };

    final mapped = mapEnrolledSemestersToDisbursements(doc);

    expect(mapped, hasLength(1));
    expect(totalDisbursed(mapped), 25000);
  });

  test('sorts by enrolledAt regardless of array order', () {
    final doc = {
      'academicYear': '2026-2027',
      'enrolledSemesters': [
        {
          'schoolYear': '2026-2027',
          'semester': '2nd Semester',
          'grantedAmount': 25000,
          'status': 'disbursed',
          'enrolledAt': '2026-07-31T21:00:04.959Z',
        },
        {
          'schoolYear': '2026-2027',
          'semester': '1st Semester',
          'grantedAmount': 25000,
          'status': 'disbursed',
          'enrolledAt': '2026-07-31T20:18:47.781Z',
        },
      ],
    };

    final mapped = mapEnrolledSemestersToDisbursements(doc)!;

    expect(mapped[0].semester, '1st Semester');
    expect(mapped[1].semester, '2nd Semester');
  });

  test('an on-hold semester (0 granted) does not inflate the total', () {
    final doc = {
      'academicYear': '2026-2027',
      'enrolledSemesters': [
        {
          'schoolYear': '2026-2027',
          'semester': '1st Semester',
          'grantedAmount': 25000,
          'status': 'disbursed',
          'enrolledAt': '2026-07-31T20:18:47.781Z',
        },
        {
          'schoolYear': '2026-2027',
          'semester': '2nd Semester',
          'grantedAmount': 0,
          'status': 'on_hold',
          'enrolledAt': '2026-07-31T21:00:04.959Z',
        },
      ],
    };

    final mapped = mapEnrolledSemestersToDisbursements(doc);

    expect(totalDisbursed(mapped), 25000);
  });

  test('returns null (not an empty list) when there are no grants yet', () {
    expect(mapEnrolledSemestersToDisbursements({'academicYear': '2026-2027'}), isNull);
    expect(mapEnrolledSemestersToDisbursements({'enrolledSemesters': []}), isNull);
    expect(mapEnrolledSemestersToDisbursements(null), isNull);
  });
}
