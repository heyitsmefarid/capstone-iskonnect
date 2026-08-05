import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/student_model.dart';

StudentModel _buildBaseStudent() {
  return StudentModel(
    firstName: 'Juan',
    middleName: '',
    lastName: 'Dela Cruz',
    street: 'Mabini St',
    barangay: 'San Vicente',
    city: 'Calapan',
    province: 'Oriental Mindoro',
    gender: 'Male',
    dateOfBirth: DateTime(2001, 3, 15),
    contactNumber: '09181234567',
    email: 'juan.delacruz@example.com',
    password: 'secret123',
    schoolName: 'Mindoro State University',
    yearLevel: '3',
    academicProgram: 'BS Computer Science',
    academicYear: '2025-2026',
    semester: '1st Semester',
  );
}

void main() {
  group('evaluation score fields', () {
    test('celebrationSeen defaults to false', () {
      expect(_buildBaseStudent().celebrationSeen, isFalse);
    });

    test('hasFullEvaluation is false until all three scores are set', () {
      final student = _buildBaseStudent();
      expect(student.hasFullEvaluation, isFalse);

      final partial =
          student.copyWith(requirementsScore: 18, economicScore: 25);
      expect(partial.hasFullEvaluation, isFalse);

      final full = partial.copyWith(examScore: 88);
      expect(full.hasFullEvaluation, isTrue);
    });

    test('totalEvaluationScore is null unless the evaluation is complete', () {
      final student = _buildBaseStudent()
          .copyWith(requirementsScore: 18, economicScore: 25);
      expect(student.totalEvaluationScore, isNull);
    });

    test('totalEvaluationScore applies requirements + economic + exam*0.5, rounded', () {
      final student = _buildBaseStudent().copyWith(
        requirementsScore: 18,
        economicScore: 25,
        examScore: 88,
      );
      // 18 + 25 + (88 * 0.5) = 87
      expect(student.totalEvaluationScore, 87);
    });

    test('round-trips requirementsScore/economicScore/examScore/celebrationSeen through JSON', () {
      final student = _buildBaseStudent().copyWith(
        requirementsScore: 20,
        economicScore: 30,
        examScore: 95.0,
        celebrationSeen: true,
      );

      final restored = StudentModel.fromJson(student.toJson());

      expect(restored.requirementsScore, 20);
      expect(restored.economicScore, 30);
      expect(restored.examScore, 95.0);
      expect(restored.celebrationSeen, isTrue);
    });
  });

  group('rejection fields', () {
    test('rejectionSeen defaults to false and rejectionReason to null', () {
      final student = _buildBaseStudent();
      expect(student.rejectionSeen, isFalse);
      expect(student.rejectionReason, isNull);
    });

    test('copyWith updates rejectionReason/rejectionSeen', () {
      final student = _buildBaseStudent().copyWith(
        rejectionReason: 'Incomplete requirements',
        rejectionSeen: true,
      );
      expect(student.rejectionReason, 'Incomplete requirements');
      expect(student.rejectionSeen, isTrue);
    });

    test('round-trips rejectionReason/rejectionSeen through JSON', () {
      final student = _buildBaseStudent().copyWith(
        rejectionReason: 'Incomplete requirements',
        rejectionSeen: true,
      );

      final restored = StudentModel.fromJson(student.toJson());

      expect(restored.rejectionReason, 'Incomplete requirements');
      expect(restored.rejectionSeen, isTrue);
    });

    test('fromJson defaults rejectionReason/rejectionSeen when absent (legacy doc)', () {
      final json = {
        'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
        'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
        'province': 'Oriental Mindoro', 'gender': 'Female',
      };
      final model = StudentModel.fromJson(json);
      expect(model.rejectionReason, isNull);
      expect(model.rejectionSeen, isFalse);
    });
  });

  group('account-activation fields', () {
    test('fromJson defaults new activation fields when absent (legacy doc)', () {
      final json = {
        'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
        'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
        'province': 'Oriental Mindoro', 'gender': 'Female',
      };
      final model = StudentModel.fromJson(json);
      expect(model.uid, isNull);
      expect(model.mustChangePassword, isFalse);
      expect(model.password, isEmpty);
    });

    test('fromJson reads the new activation fields when present', () {
      final json = {
        'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
        'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
        'province': 'Oriental Mindoro', 'gender': 'Female',
        'uid': 'abc123', 'mustChangePassword': true,
        'totalScholarshipSemesters': 8, 'grantSchoolYear': '2024-2025',
      };
      final model = StudentModel.fromJson(json);
      expect(model.uid, 'abc123');
      expect(model.mustChangePassword, isTrue);
      expect(model.totalScholarshipSemesters, 8);
      expect(model.grantSchoolYear, '2024-2025');
    });

    test('StudentModel can be constructed without a password (new Firebase-Auth flow)', () {
      final model = StudentModel(
        firstName: 'Ana', middleName: '', lastName: 'Cruz',
        street: 'Rizal St', barangay: 'Poblacion', city: 'Calapan',
        province: 'Oriental Mindoro', gender: 'Female', dateOfBirth: DateTime(2002, 5, 10),
        contactNumber: '09171234567', email: 'a@example.com',
        schoolName: 'MinSU', yearLevel: '2', academicProgram: 'BSIT',
        academicYear: '2025-2026', semester: '1st Semester',
      );
      expect(model.password, isEmpty);
    });
  });

  group('emergency contact fields', () {
    test('fromJson reads emergencyContactName/Phone when present', () {
      final json = {
        'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
        'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
        'province': 'Oriental Mindoro', 'gender': 'Female',
        'emergencyContactName': 'Juana Cruz', 'emergencyContactPhone': '0912-345-6789',
      };
      final model = StudentModel.fromJson(json);
      expect(model.emergencyContactName, 'Juana Cruz');
      expect(model.emergencyContactPhone, '0912-345-6789');
    });

    test('fromJson defaults emergencyContactName/Phone to null when absent', () {
      final json = {
        'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
        'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
        'province': 'Oriental Mindoro', 'gender': 'Female',
      };
      final model = StudentModel.fromJson(json);
      expect(model.emergencyContactName, isNull);
      expect(model.emergencyContactPhone, isNull);
    });

    test('copyWith updates emergencyContactName/Phone', () {
      final model = StudentModel(
        firstName: 'Ana', middleName: '', lastName: 'Cruz',
        street: 'Rizal St', barangay: 'Poblacion', city: 'Calapan',
        province: 'Oriental Mindoro', gender: 'Female', dateOfBirth: DateTime(2002, 5, 10),
        contactNumber: '09171234567', email: 'a@example.com',
        schoolName: 'MinSU', yearLevel: '2', academicProgram: 'BSIT',
        academicYear: '2025-2026', semester: '1st Semester',
      );
      final updated = model.copyWith(emergencyContactName: 'Juana Cruz', emergencyContactPhone: '0912-345-6789');
      expect(updated.emergencyContactName, 'Juana Cruz');
      expect(updated.emergencyContactPhone, '0912-345-6789');
    });
  });

  group('idCardAddress', () {
    test('is barangay and city only — no house number, street or province', () {
      final student = _buildBaseStudent().copyWith(houseNo: '123');

      expect(student.idCardAddress, 'San Vicente, Calapan City');
    });

    test('omits the "Brgy." prefix that fullAddress carries', () {
      final student = _buildBaseStudent();

      expect(student.idCardAddress, isNot(contains('Brgy')));
      // fullAddress is deliberately left untouched for the profile screen.
      expect(student.fullAddress, contains('Brgy.'));
    });

    test('appends the "City" suffix the stored value omits', () {
      expect(_buildBaseStudent().copyWith(city: 'Calapan').idCardAddress,
          endsWith('Calapan City'));
    });

    test('does not double the suffix when it is already stored', () {
      for (final stored in ['Calapan City', 'calapan city', 'CALAPAN CITY']) {
        expect(
          _buildBaseStudent().copyWith(city: stored).idCardAddress,
          endsWith(stored),
          reason: '"$stored" already carries the suffix',
        );
      }
    });

    test('drops blank parts rather than emitting a stray comma', () {
      expect(_buildBaseStudent().copyWith(barangay: '').idCardAddress, 'Calapan City');
      expect(_buildBaseStudent().copyWith(city: '').idCardAddress, 'San Vicente');
      expect(
        _buildBaseStudent().copyWith(barangay: '  ', city: '  ').idCardAddress,
        isEmpty,
      );
    });
  });
}
