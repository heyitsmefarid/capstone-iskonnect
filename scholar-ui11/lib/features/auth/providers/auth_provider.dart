import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/core/constants/firebase_env.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Shared preferences keys
const String _kLoggedInStudentId = 'logged_in_student_id';
const String _kRegisteredStudents = 'registered_students';
const String _kStudentsCollection = 'users';

// Auth State
class AuthState {
  final bool isLoggedIn;
  final bool isLoading;
  final bool isInitialized;
  final StudentModel? student;
  final String? error;

  const AuthState({
    this.isLoggedIn = false,
    this.isLoading = false,
    this.isInitialized = false,
    this.student,
    this.error,
  });

  AuthState copyWith({
    bool? isLoggedIn,
    bool? isLoading,
    bool? isInitialized,
    StudentModel? student,
    String? error,
  }) {
    return AuthState(
      isLoggedIn: isLoggedIn ?? this.isLoggedIn,
      isLoading: isLoading ?? this.isLoading,
      isInitialized: isInitialized ?? this.isInitialized,
      student: student ?? this.student,
      error: error,
    );
  }
}

// Auth Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  static final Map<String, StudentModel> _registeredStudents = {};
  static StudentModel? _pendingRegistration;
  static const Duration _firestoreTimeout = Duration(seconds: 4);

  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _studentSub;

  AuthNotifier() : super(const AuthState()) {
    _initializeAuth();
  }

  /// Live-listen to the logged-in student's Firestore document so changes made
  /// by the admin (approval, status, scholar id, scores) appear in real time.
  void _listenToStudentDoc(String studentId) {
    final collection = _studentsCollection;
    if (collection == null) return;
    _studentSub?.cancel();
    _studentSub = collection.doc(studentId).snapshots().listen(
      (snapshot) {
        final data = snapshot.data();
        // Account removed/archived by the admin while signed in, or the doc was
        // hard-deleted — end the session immediately.
        if (!snapshot.exists || _isRemovedData(data)) {
          if (state.student?.id == studentId) {
            _registeredStudents.remove(studentId);
            _saveStudentsToStorage();
            _saveLoggedInUser(null);
            _studentSub?.cancel();
            _studentSub = null;
            // Fresh state (copyWith can't null out `student`) → back to login.
            state = const AuthState(isInitialized: true);
          }
          return;
        }
        if (data == null) return;
        try {
          final updated = _normalizeStudentStatus(StudentModel.fromJson(data));
          _registeredStudents[updated.id] = updated;
          _saveStudentsToStorage();
          if (state.student?.id == updated.id) {
            state = state.copyWith(student: updated);
          }
        } catch (_) {
          // Ignore malformed snapshots.
        }
      },
      onError: (_) {},
    );
  }

  @override
  void dispose() {
    _studentSub?.cancel();
    super.dispose();
  }

  // The admin panel "deletes" accounts with a soft-delete: the Firestore doc
  // stays but is flagged. Such accounts must not log in or auto-resume.
  static bool _isRemovedData(Map<String, dynamic>? data) {
    if (data == null) return true;
    return data['adminStatus'] == 'removed' ||
        data['archived'] == true ||
        data['applicationStatus']?.toString().toLowerCase() == 'removed';
  }

  bool get _isFirestoreReady => FirebaseEnv.isConfigured && Firebase.apps.isNotEmpty;

  /// Ensures anonymous sign-in is complete before any Firestore query runs.
  /// Without this, Firestore returns permission-denied and the catch returns null.
  Future<void> _ensureAnonymousAuth() async {
    if (!_isFirestoreReady) return;
    try {
      final auth = FirebaseAuth.instance;
      if (auth.currentUser == null) {
        await auth.signInAnonymously();
      }
    } catch (_) {}
  }

  CollectionReference<Map<String, dynamic>>? get _studentsCollection {
    if (!_isFirestoreReady) {
      return null;
    }
    return FirebaseFirestore.instance.collection(_kStudentsCollection);
  }

  Future<void> _saveStudentToFirestore(StudentModel student) async {
    await _ensureAnonymousAuth();
    final collection = _studentsCollection;
    if (collection == null) return;

    await collection
        .doc(student.id)
        .set(student.toJson(), SetOptions(merge: true))
        .timeout(const Duration(seconds: 10));
  }

  Future<void> _saveStudentToFirestoreSafely(StudentModel student) async {
    try {
      await _saveStudentToFirestore(student);
    } catch (_) {
      // Keep local auth flow working even if Firestore is slow/unavailable.
    }
  }

  Future<StudentModel?> _findStudentByEmailFromFirestore(String email) async {
    await _ensureAnonymousAuth();
    final collection = _studentsCollection;
    if (collection == null) {
      state = state.copyWith(error: 'Firebase not configured. Cannot look up account.');
      return null;
    }

    // Try up to 2 times — first attempt may hit a cold auth state.
    for (int attempt = 0; attempt < 2; attempt++) {
      try {
        final snapshot = await collection
            .where('email', isEqualTo: email.toLowerCase())
            .get()
            .timeout(const Duration(seconds: 10));

        if (snapshot.docs.isNotEmpty) {
          // Duplicate user docs can exist for one email (e.g. an old copy that
          // was archived/removed alongside the current active one). Prefer an
          // ACTIVE document; only block when every match is removed/archived,
          // so a stale duplicate can't lock a valid account out.
          Map<String, dynamic>? activeData;
          for (final doc in snapshot.docs) {
            if (!_isRemovedData(doc.data())) {
              activeData = doc.data();
              break;
            }
          }
          if (activeData != null) {
            return _normalizeStudentStatus(StudentModel.fromJson(activeData));
          }
          // Every matching document is removed/archived.
          state = state.copyWith(
            isLoading: false,
            error: 'This account is no longer active. Please contact the City Education Department.',
          );
          return null;
        }
        return null; // Query succeeded but no matching document.
      } catch (e) {
        if (attempt == 0) {
          // Wait and re-auth before retry.
          await Future.delayed(const Duration(seconds: 2));
          await _ensureAnonymousAuth();
        } else {
          // Surface the real error on final attempt.
          state = state.copyWith(
            isLoading: false,
            error: 'Could not reach server: ${e.toString().substring(0, e.toString().length.clamp(0, 80))}',
          );
          return null;
        }
      }
    }
    return null;
  }

  static StudentModel _normalizeStudentStatus(StudentModel student) {
    if (student.studentType == StudentType.applicant &&
        student.scholarshipStatus.toLowerCase() == 'active') {
      return student.copyWith(scholarshipStatus: 'Pending');
    }
    return student;
  }

  // Initialize auth state from shared preferences
  Future<void> _initializeAuth() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Load registered students from storage
      final storedStudentsJson = prefs.getString(_kRegisteredStudents);
      if (storedStudentsJson != null) {
        final Map<String, dynamic> storedStudents = jsonDecode(
          storedStudentsJson,
        );
        storedStudents.forEach((key, value) {
          if (!_registeredStudents.containsKey(key)) {
            try {
              _registeredStudents[key] = _normalizeStudentStatus(
                StudentModel.fromJson(Map<String, dynamic>.from(value as Map)),
              );
            } catch (_) {
              // Skip malformed entries so one bad doc can't block all accounts.
            }
          }
        });
      }

      // Check if there's a logged in user. Firestore is authoritative: an
      // account the admin removed/archived must NOT auto-resume, even though a
      // stale copy may still sit in the local cache. We only fall back to the
      // cache when the server is unreachable (offline support).
      final loggedInId = prefs.getString(_kLoggedInStudentId);
      if (loggedInId != null) {
        final collection = _studentsCollection;
        Map<String, dynamic>? remoteData;
        var reachedServer = false;
        if (collection != null) {
          await _ensureAnonymousAuth();
          try {
            final snap = await collection.doc(loggedInId).get().timeout(_firestoreTimeout);
            reachedServer = true;
            remoteData = snap.exists ? snap.data() : null;
          } catch (_) {
            reachedServer = false;
          }
        }

        if (reachedServer) {
          if (remoteData == null || _isRemovedData(remoteData)) {
            // Account was deleted/archived — clear the stale session so the
            // app returns to the login screen instead of opening it.
            _registeredStudents.remove(loggedInId);
            await _saveStudentsToStorage();
            await _saveLoggedInUser(null);
            // Fresh state (copyWith can't null out `student`) → back to login.
            state = const AuthState(isInitialized: true);
            return;
          }
          final student = _normalizeStudentStatus(StudentModel.fromJson(remoteData));
          _registeredStudents[loggedInId] = student;
          state = state.copyWith(isLoggedIn: true, isInitialized: true, student: student);
          _listenToStudentDoc(loggedInId);
          return;
        }

        // Server unreachable — fall back to a cached copy if we have one.
        final cached = _registeredStudents[loggedInId];
        if (cached != null) {
          state = state.copyWith(isLoggedIn: true, isInitialized: true, student: cached);
          _listenToStudentDoc(loggedInId);
          return;
        }
      }

      state = state.copyWith(isInitialized: true);
    } catch (e) {
      state = state.copyWith(isInitialized: true);
    }
  }

  // Save registered students to storage
  Future<void> _saveStudentsToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final studentsMap = _registeredStudents.map(
        (key, value) => MapEntry(key, value.toJson()),
      );
      await prefs.setString(_kRegisteredStudents, jsonEncode(studentsMap));
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Save logged in user ID
  Future<void> _saveLoggedInUser(String? userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (userId != null) {
        await prefs.setString(_kLoggedInStudentId, userId);
      } else {
        await prefs.remove(_kLoggedInStudentId);
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Register a new student
  Future<bool> register(StudentModel student) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final normalizedEmail = student.email.trim().toLowerCase();
      final normalizedStudent = student.copyWith(email: normalizedEmail);

      // Validate required fields
      if (normalizedStudent.firstName.isEmpty || normalizedStudent.lastName.isEmpty) {
        state = state.copyWith(
          isLoading: false,
          error: 'First name and last name are required.',
        );
        return false;
      }

      if (normalizedEmail.isEmpty) {
        state = state.copyWith(
          isLoading: false,
          error: 'Email address is required.',
        );
        return false;
      }

      // Validate email format
      final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
      if (!emailRegex.hasMatch(normalizedEmail)) {
        state = state.copyWith(
          isLoading: false,
          error: 'Please enter a valid email address.',
        );
        return false;
      }

      if (normalizedStudent.password.length < 6) {
        state = state.copyWith(
          isLoading: false,
          error: 'Password must be at least 6 characters long.',
        );
        return false;
      }

      // Simulate network delay
      await Future.delayed(const Duration(milliseconds: 1500));

      // Check if email already exists (case-insensitive)
      if (_registeredStudents.values.any(
        (s) => s.email.toLowerCase() == normalizedEmail,
      )) {
        state = state.copyWith(
          isLoading: false,
          error:
              'This email address is already registered. Please use a different email or try logging in.',
        );
        return false;
      }

      // Store the student
  final storedStudent = _normalizeStudentStatus(normalizedStudent);
  _registeredStudents[storedStudent.id] = storedStudent;
  _pendingRegistration = storedStudent;

      // Save to persistent storage
      await _saveStudentsToStorage();
      await _saveStudentToFirestoreSafely(storedStudent);

      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error:
            'Registration failed. Please check your information and try again.',
      );
      return false;
    }
  }

  // Get pending registration (for success screen)
  StudentModel? getPendingRegistration() {
    return _pendingRegistration;
  }

  // Clear pending registration
  void clearPendingRegistration() {
    _pendingRegistration = null;
  }

  // Login
  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);

    // Validate inputs
    if (email.isEmpty) {
      state = state.copyWith(
        isLoading: false,
        error: 'Please enter your email address.',
      );
      return false;
    }

    if (password.isEmpty) {
      state = state.copyWith(
        isLoading: false,
        error: 'Please enter your password.',
      );
      return false;
    }

    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 1000));

    try {
      // Find student by email
      final studentQuery = _registeredStudents.values.where(
        (s) => s.email.toLowerCase() == email.toLowerCase(),
      );

      StudentModel? student;
      if (studentQuery.isNotEmpty) {
        student = studentQuery.first;
      } else {
        student = await _findStudentByEmailFromFirestore(email.toLowerCase());
        if (student != null) {
          _registeredStudents[student.id] = student;
          await _saveStudentsToStorage();
        }
      }

      if (student == null) {
        // Preserve a specific reason set during lookup (e.g. the account was
        // removed/archived by the admin, or the server was unreachable) instead
        // of masking it with the generic "no account found" message.
        state = state.copyWith(
          isLoading: false,
          error: state.error ??
              'No account found with this email address. Please check your email or register a new account.',
        );
        return false;
      }

      // Check password
      if (student.password != password) {
        state = state.copyWith(
          isLoading: false,
          error: 'Incorrect password. Please try again.',
        );
        return false;
      }

      state = state.copyWith(
        isLoggedIn: true,
        isLoading: false,
        student: student,
      );

      // Save login state to persistent storage
      await _saveLoggedInUser(student.id);

      await _saveStudentToFirestoreSafely(student);
      _listenToStudentDoc(student.id);

      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'An unexpected error occurred. Please try again later.',
      );
      return false;
    }
  }

  /// Resets the password for the account with [email] after the emailed OTP has
  /// been verified (forgot-password flow). Updates the Firestore `password`
  /// field the login check reads. Returns false if no account matches.
  Future<bool> resetPasswordByEmail(String email, String newPassword) async {
    final normalized = email.trim().toLowerCase();

    StudentModel? student;
    for (final s in _registeredStudents.values) {
      if (s.email.toLowerCase() == normalized) {
        student = s;
        break;
      }
    }
    student ??= await _findStudentByEmailFromFirestore(normalized);
    if (student == null) return false;

    final updated = student.copyWith(password: newPassword);
    _registeredStudents[updated.id] = updated;
    await _saveStudentsToStorage();
    await _saveStudentToFirestoreSafely(updated);
    return true;
  }

  // Login with registration (auto-login after registration)
  Future<bool> loginWithStudent(StudentModel student) async {
    state = state.copyWith(isLoading: true, error: null);

    await Future.delayed(const Duration(milliseconds: 500));

    state = state.copyWith(
      isLoggedIn: true,
      isLoading: false,
      student: student,
    );

    // Save login state to persistent storage
    await _saveLoggedInUser(student.id);
    await _saveStudentToFirestoreSafely(student);
    _listenToStudentDoc(student.id);

    return true;
  }

  // Logout
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);

    // Clear login state from persistent storage
    await _saveLoggedInUser(null);
    await _studentSub?.cancel();
    _studentSub = null;

    await Future.delayed(const Duration(milliseconds: 500));

    state = AuthState(isInitialized: true);
  }

  // Update profile
  // Updates editable profile fields. Every argument is optional so existing
  // callers (contact/email only) keep working, while the Edit Profile screen can
  // now let a scholar fill in any field — important for bulk-imported accounts
  // that start with only name/school/program populated.
  void updateProfile({
    String? firstName,
    String? middleName,
    String? lastName,
    String? suffix,
    String? contactNumber,
    String? email,
    String? gender,
    DateTime? dateOfBirth,
    String? houseNo,
    String? street,
    String? barangay,
    String? city,
    String? province,
    String? schoolName,
    String? academicProgram,
    String? yearLevel,
    String? academicYear,
  }) {
    if (state.student == null) return;

    final normalizedEmail = email?.trim().toLowerCase();

    state = state.copyWith(
      student: state.student!.copyWith(
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
        suffix: suffix,
        contactNumber: contactNumber,
        email: normalizedEmail,
        gender: gender,
        dateOfBirth: dateOfBirth,
        houseNo: houseNo,
        street: street,
        barangay: barangay,
        city: city,
        province: province,
        schoolName: schoolName,
        academicProgram: academicProgram,
        yearLevel: yearLevel,
        academicYear: academicYear,
      ),
    );

    // Update in storage
    _registeredStudents[state.student!.id] = state.student!;
    _saveStudentsToStorage();
    _saveStudentToFirestoreSafely(state.student!);
  }

  // Update profile picture
  Future<void> updateProfilePicture(String? base64Image) async {
    if (state.student == null) return;

    state = state.copyWith(
      student: state.student!.copyWith(profilePicture: base64Image),
    );

    // Update in storage
    _registeredStudents[state.student!.id] = state.student!;
    await _saveStudentsToStorage();
    await _saveStudentToFirestoreSafely(state.student!);
  }

  // Update scholarship status
  void updateScholarshipStatus(String status) {
    if (state.student == null) return;

    state = state.copyWith(
      student: state.student!.copyWith(scholarshipStatus: status),
    );

    _registeredStudents[state.student!.id] = state.student!;
    _saveStudentToFirestoreSafely(state.student!);
  }

  // Update applicant application status
  Future<void> updateApplicationStatus(String status) async {
    if (state.student == null) return;

    final updatedStudent = state.student!.copyWith(applicationStatus: status);
    state = state.copyWith(student: updatedStudent);
    _registeredStudents[updatedStudent.id] = updatedStudent;
    await _saveStudentsToStorage();
    await _saveStudentToFirestoreSafely(updatedStudent);
  }

  /// Persist submitted scholarship requirements to Firestore so the admin
  /// panel can see which documents the applicant has submitted.
  Future<void> saveApplicationRequirements(
    Map<String, dynamic> requirements,
  ) async {
    if (state.student == null) return;
    await _ensureAnonymousAuth();
    final collection = _studentsCollection;
    if (collection == null) return;
    try {
      await collection
          .doc(state.student!.id)
          .set({'requirements': requirements}, SetOptions(merge: true))
          .timeout(const Duration(seconds: 10));
    } catch (_) {}
  }

}

// Provider
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

// Convenience providers
final currentStudentProvider = Provider<StudentModel?>((ref) {
  return ref.watch(authStateProvider).student;
});

final isLoggedInProvider = Provider<bool>((ref) {
  return ref.watch(authStateProvider).isLoggedIn;
});

/// Provider to check if current user is a scholar
final isScholarProvider = Provider<bool>((ref) {
  final student = ref.watch(currentStudentProvider);
  return student?.isScholar ?? false;
});

/// Provider to check if current user is an applicant
final isApplicantProvider = Provider<bool>((ref) {
  final student = ref.watch(currentStudentProvider);
  return student?.isApplicant ?? true;
});
