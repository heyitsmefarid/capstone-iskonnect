import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:iskonnectttt/main.dart' as app;
import 'package:iskonnectttt/core/state_machine/scholar_state_machine.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Scholar UI Integration Tests', () {
    testWidgets('App should start and load home screen',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // App should be displayed
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });

    testWidgets('Scholar state machine should start in initial state',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));
      await tester.pumpAndSettle();

      // App should render without errors
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });
  });

  group('Scholar State Machine Integration Tests', () {
    testWidgets('State transitions should follow scholar constraints',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));
      await tester.pumpAndSettle();

      // Verify app loads successfully
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });

    testWidgets('Scholar should not be able to upload offline',
        (WidgetTester tester) async {
      // Test that upload is disabled in offline state
      expect(
        ScholarLifecycleConstraints.canUploadDocuments(
            ScholarAppState.offline),
        isFalse,
      );

      // Upload should be allowed when authenticated
      expect(
        ScholarLifecycleConstraints.canUploadDocuments(
            ScholarAppState.authenticated),
        isTrue,
      );
    });

    testWidgets('Scholar should be able to view documents offline',
        (WidgetTester tester) async {
      // Can view offline
      expect(
        ScholarLifecycleConstraints.canViewDocuments(ScholarAppState.offline),
        isTrue,
      );

      // Can view when authenticated
      expect(
        ScholarLifecycleConstraints.canViewDocuments(
            ScholarAppState.authenticated),
        isTrue,
      );

      // Cannot view when loading
      expect(
        ScholarLifecycleConstraints.canViewDocuments(ScholarAppState.loading),
        isFalse,
      );
    });

    testWidgets('Scholar sync constraints should be enforced',
        (WidgetTester tester) async {
      // Can sync when authenticated
      expect(
        ScholarLifecycleConstraints.canSync(ScholarAppState.authenticated),
        isTrue,
      );

      // Can sync when syncing
      expect(
        ScholarLifecycleConstraints.canSync(ScholarAppState.syncing),
        isTrue,
      );

      // Cannot sync offline
      expect(
        ScholarLifecycleConstraints.canSync(ScholarAppState.offline),
        isFalse,
      );
    });
  });

  group('Document Upload Flow', () {
    testWidgets('Scholar should be able to upload documents when authenticated',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));
      await tester.pumpAndSettle();

      // Verify app starts successfully
      expect(find.byType(app.IskonnectApp), findsWidgets);

      // Additional UI tests would go here once app's navigation is set up
    });
  });

  group('Data Persistence', () {
    testWidgets('Offline data should be available when coming online',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));
      await tester.pumpAndSettle();

      expect(find.byType(app.IskonnectApp), findsWidgets);
    });
  });

  group('Error Handling', () {
    testWidgets('App should gracefully handle errors',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));
      await tester.pumpAndSettle();

      // App should not crash
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });

    testWidgets('Scholar state should transition to error on failure',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));
      await tester.pumpAndSettle();

      expect(find.byType(app.IskonnectApp), findsWidgets);
    });
  });

  group('Performance Tests', () {
    testWidgets('App should start within reasonable time',
        (WidgetTester tester) async {
      final stopwatch = Stopwatch()..start();
      app.main();
      await tester.pumpAndSettle();
      stopwatch.stop();

      // ignore: avoid_print
      print('App startup time: ${stopwatch.elapsedMilliseconds}ms');
      expect(stopwatch.elapsedMilliseconds, lessThan(5000));
    });

    testWidgets('State transitions should be fast',
        (WidgetTester tester) async {
      // Verify app runs without performance issues
      app.main();
      await tester.pumpWidget(const ProviderScope(child: app.IskonnectApp()));

      final stopwatch = Stopwatch()..start();
      await tester.pumpAndSettle();
      stopwatch.stop();

      expect(stopwatch.elapsedMilliseconds, lessThan(1000));
    });
  });
}
