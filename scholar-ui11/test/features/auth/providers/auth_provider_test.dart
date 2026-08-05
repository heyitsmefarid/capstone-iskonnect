import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

StudentModel _buildScholar() {
  return StudentModel(
    firstName: 'Ana',
    middleName: '',
    lastName: 'Cruz',
    street: 'Rizal St',
    barangay: 'Poblacion',
    city: 'Calapan',
    province: 'Oriental Mindoro',
    gender: 'Female',
    dateOfBirth: DateTime(2002, 5, 10),
    contactNumber: '09171234567',
    email: 'ana.cruz@example.com',
    password: 'secret123',
    schoolName: 'Mindoro State University',
    yearLevel: '2',
    academicProgram: 'BS Information Technology',
    academicYear: '2025-2026',
    semester: '1st Semester',
    studentType: StudentType.scholar,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('markCelebrationSeen flips celebrationSeen to true for the logged-in student', () async {
    SharedPreferences.setMockInitialValues({});
    // Built through the real provider (not `AuthNotifier()` directly) since
    // the constructor now needs a genuine `Ref` to invalidate the other
    // per-scholar providers on login/logout — see resetPerStudentProviders.
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(authStateProvider.notifier);
    final student = _buildScholar();

    await notifier.loginWithStudent(student);
    expect(notifier.state.student?.celebrationSeen, isFalse);

    await notifier.markCelebrationSeen();

    expect(notifier.state.student?.celebrationSeen, isTrue);
  });

  test('markCelebrationSeen is a no-op when no student is logged in', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(authStateProvider.notifier);

    await notifier.markCelebrationSeen();

    expect(notifier.state.student, isNull);
  });
}
