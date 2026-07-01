import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/splash/screens/splash_screen.dart';
import 'package:iskonnectttt/features/auth/screens/login_screen.dart';
import 'package:iskonnectttt/features/auth/screens/registration_screen.dart';
import 'package:iskonnectttt/features/auth/screens/registration_success_screen.dart';
import 'package:iskonnectttt/features/auth/screens/email_verification_screen.dart';
import 'package:iskonnectttt/features/auth/screens/forgot_password_screen.dart';
import 'package:iskonnectttt/features/dashboard/screens/dashboard_screen.dart';
import 'package:iskonnectttt/features/dashboard/screens/applicant_dashboard_screen.dart';
import 'package:iskonnectttt/features/profile/screens/profile_screen.dart';
import 'package:iskonnectttt/features/profile/screens/edit_profile_screen.dart';
import 'package:iskonnectttt/features/profile/screens/scholarship_timeline_screen.dart';
import 'package:iskonnectttt/features/qr_code/screens/qr_code_screen.dart';
import 'package:iskonnectttt/features/attendance/screens/attendance_screen.dart';
import 'package:iskonnectttt/features/requirements/screens/requirements_screen.dart';
import 'package:iskonnectttt/features/grades/screens/grades_screen.dart';
import 'package:iskonnectttt/features/grades/screens/add_grade_screen.dart';
import 'package:iskonnectttt/features/assessment/screens/assessment_screen.dart';
import 'package:iskonnectttt/features/announcements/screens/announcements_screen.dart';
import 'package:iskonnectttt/features/announcements/screens/announcement_detail_screen.dart';
import 'package:iskonnectttt/features/messaging/screens/messaging_screen.dart';
import 'package:iskonnectttt/features/scholarship_application/screens/scholarship_application_screen.dart';
import 'package:iskonnectttt/features/celebration/screens/congratulations_screen.dart';
import 'package:iskonnectttt/shared/widgets/main_shell.dart';

// Provider to track only auth status changes (not profile updates)
final _authStatusProvider = Provider<({bool isLoggedIn, bool isInitialized})>((
  ref,
) {
  final authState = ref.watch(authStateProvider);
  return (
    isLoggedIn: authState.isLoggedIn,
    isInitialized: authState.isInitialized,
  );
});

// Narrow provider so the celebration refresh only fires on the one
// transition that matters (applicant -> scholar, or celebration
// acknowledged) — not on every grade/attendance update to the student doc.
final _celebrationStatusProvider = Provider<({bool isScholar, bool celebrationSeen})>((
  ref,
) {
  final student = ref.watch(currentStudentProvider);
  return (
    isScholar: student?.isScholar ?? false,
    celebrationSeen: student?.celebrationSeen ?? false,
  );
});

/// Pure decision used by the router's redirect callback: where (if anywhere)
/// to send the user based on celebration status. A standalone function so
/// it's unit-testable without constructing a GoRouter/ProviderScope.
String? celebrationRedirectTarget({
  required bool celebrationPending,
  required bool isCelebrating,
}) {
  if (celebrationPending && !isCelebrating) return '/celebration';
  if (!celebrationPending && isCelebrating) return '/dashboard';
  return null;
}

/// Notifies go_router to re-run `redirect` for the CURRENT location (without
/// recreating the router or losing navigation state) whenever the scholar's
/// celebration status changes — e.g. the admin approves them while they're
/// mid-session on some other screen.
class _CelebrationRefreshNotifier extends ChangeNotifier {
  late final ProviderSubscription _subscription;

  _CelebrationRefreshNotifier(Ref ref) {
    _subscription = ref.listen(_celebrationStatusProvider, (previous, next) {
      if (previous != next) notifyListeners();
    });
  }

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStatus = ref.watch(_authStatusProvider);
  final celebrationRefresh = _CelebrationRefreshNotifier(ref);
  ref.onDispose(celebrationRefresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    refreshListenable: celebrationRefresh,
    redirect: (context, state) {
      final isLoggedIn = authStatus.isLoggedIn;
      final isInitialized = authStatus.isInitialized;
      final isLoggingIn = state.matchedLocation == '/login';
      final isRegistering = state.matchedLocation == '/register';
      final isSplash = state.matchedLocation == '/splash';
      final isRegistrationSuccess =
          state.matchedLocation == '/registration-success';
      final isVerifyingEmail = state.matchedLocation == '/verify-email';
      final isForgotPassword = state.matchedLocation == '/forgot-password';

      // Allow splash screen always
      if (isSplash) return null;

      // Allow registration, registration success, email verification and the
      // forgot-password flow without being logged in.
      if (isRegistering ||
          isRegistrationSuccess ||
          isVerifyingEmail ||
          isForgotPassword) {
        return null;
      }

      // If auth is not initialized yet, stay on splash or show login
      if (!isInitialized) {
        return isSplash ? null : '/splash';
      }

      // If not logged in, redirect to login
      if (!isLoggedIn) {
        return isLoggingIn ? null : '/login';
      }

      final celebration = ref.read(_celebrationStatusProvider);
      final celebrationPending = celebration.isScholar && !celebration.celebrationSeen;
      final isCelebrating = state.matchedLocation == '/celebration';

      // If logged in and trying to access login, redirect to dashboard (or
      // the celebration screen first, if it hasn't been seen yet).
      if (isLoggedIn && isLoggingIn) {
        return celebrationPending ? '/celebration' : '/dashboard';
      }

      return celebrationRedirectTarget(
        celebrationPending: celebrationPending,
        isCelebrating: isCelebrating,
      );
    },
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegistrationScreen(),
      ),
      GoRoute(
        path: '/registration-success',
        name: 'registration-success',
        builder: (context, state) => const RegistrationSuccessScreen(),
      ),
      GoRoute(
        path: '/verify-email',
        name: 'verify-email',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          return EmailVerificationScreen(email: email);
        },
      ),
      GoRoute(
        path: '/forgot-password',
        name: 'forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/celebration',
        name: 'celebration',
        builder: (context, state) => const CongratulationsScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            name: 'dashboard',
            builder: (context, state) => const _DashboardRouter(),
          ),
          GoRoute(
            path: '/profile',
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
            routes: [
              GoRoute(
                path: 'edit',
                name: 'edit-profile',
                builder: (context, state) => const EditProfileScreen(),
              ),
            ],
          ),
          GoRoute(
            path: '/qr-code',
            name: 'qr-code',
            builder: (context, state) => const QRCodeScreen(),
          ),
          GoRoute(
            path: '/attendance',
            name: 'attendance',
            builder: (context, state) => const AttendanceScreen(),
          ),
          GoRoute(
            path: '/requirements',
            name: 'requirements',
            builder: (context, state) {
              // Check if user is an applicant
              final student = ref.read(currentStudentProvider);
              if (student?.isApplicant ?? false) {
                return const ScholarshipApplicationScreen();
              }
              return const RequirementsScreen();
            },
          ),
          GoRoute(
            path: '/grades',
            name: 'grades',
            builder: (context, state) => const GradesScreen(),
            routes: [
              GoRoute(
                path: 'add',
                name: 'add-grade',
                builder: (context, state) => const AddGradeScreen(),
              ),
              GoRoute(
                path: 'add-cor',
                name: 'add-cor',
                builder: (context, state) =>
                    const AddGradeScreen(corOnly: true),
              ),
            ],
          ),
          GoRoute(
            path: '/assessment',
            name: 'assessment',
            builder: (context, state) => const AssessmentScreen(),
          ),
          GoRoute(
            path: '/announcements',
            name: 'announcements',
            builder: (context, state) => const AnnouncementsScreen(),
            routes: [
              GoRoute(
                path: ':id',
                name: 'announcement-detail',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return AnnouncementDetailScreen(announcementId: id);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/messaging',
            name: 'messaging',
            redirect: (context, state) {
              final student = ref.read(currentStudentProvider);
              if (student?.isApplicant ?? false) {
                return '/dashboard';
              }
              return null;
            },
            builder: (context, state) => const MessagingScreen(),
          ),
          GoRoute(
            path: '/scholarship-application',
            name: 'scholarship-application',
            builder: (context, state) => const ScholarshipApplicationScreen(),
          ),
          GoRoute(
            path: '/scholarship-timeline',
            name: 'scholarship-timeline',
            builder: (context, state) => const ScholarshipTimelineScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text('Page not found: ${state.uri.path}'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.go('/dashboard'),
              child: const Text('Go Home'),
            ),
          ],
        ),
      ),
    ),
  );
});

/// Widget that routes to the appropriate dashboard based on user type
class _DashboardRouter extends ConsumerWidget {
  const _DashboardRouter();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(currentStudentProvider);

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    // Route to appropriate dashboard based on user type
    if (student.isScholar) {
      return const DashboardScreen();
    } else {
      return const ApplicantDashboardScreen();
    }
  }
}
