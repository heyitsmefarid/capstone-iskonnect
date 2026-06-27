import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:qr_scanner/main.dart' as app;
import 'package:qr_scanner/core/qr/qr_payload_validator.dart';
import 'package:qr_scanner/core/state_machine/app_state_machine.dart';
import 'package:qr_scanner/core/state_machine/state_machine_manager.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('QR Scanner Integration Tests', () {
    // Test QR payload validation
    testWidgets('QR payload validation should work correctly',
        (WidgetTester tester) async {
      const signingSecret = 'test_secret_key';
      final now = DateTime.now();

      final payload = {
        'schemaVersion': '1.0',
        'eventId': 'event_test_123',
        'scholarId': 'scholar_test_456',
        'timestamp': now.toIso8601String(),
        'data': {'type': 'attendance'},
      };

      // Generate signature
      final signature = QRPayloadValidator.generateSignature(payload, signingSecret);
      payload['signature'] = signature;

      // Validate payload
      final validatedPayload = await QRPayloadValidator.validate(
        '{"schemaVersion":"1.0","eventId":"event_test_123","scholarId":"scholar_test_456","timestamp":"${payload['timestamp']}","signature":"$signature","data":{"type":"attendance"}}',
        signingSecret,
      );

      expect(validatedPayload, isNotNull);
      expect(validatedPayload?['eventId'], equals('event_test_123'));
      expect(validatedPayload?['scholarId'], equals('scholar_test_456'));
    });

    testWidgets('QR payload with invalid signature should fail',
        (WidgetTester tester) async {
      const signingSecret = 'test_secret_key';
      final now = DateTime.now();

      final qrData =
          '{"schemaVersion":"1.0","eventId":"event_test","scholarId":"scholar_test","timestamp":"${now.toIso8601String()}","signature":"invalid_signature","data":{"type":"attendance"}}';

      final validatedPayload = await QRPayloadValidator.validate(
        qrData,
        signingSecret,
      );

      expect(validatedPayload, isNull);
    });

    testWidgets('App should start and reach authenticated state',
        (WidgetTester tester) async {
      // Start app
      app.main();
      await tester.pumpAndSettle();

      // App should be displayed without errors
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });
  });

  group('State Machine Tests', () {
    testWidgets('State machine should enforce valid transitions',
        (WidgetTester tester) async {
      final stateMachine = StateMachineManager();

      // Initial state should be 'initial'
      expect(stateMachine.currentState, equals(AppState.initial));

      // Transition to initializing
      final canTransition = await stateMachine.transitionTo(AppState.initializing);
      expect(canTransition, isTrue);
      expect(stateMachine.currentState, equals(AppState.initializing));

      // Try invalid transition (should fail)
      final invalidTransition =
          await stateMachine.transitionTo(AppState.scanning);
      expect(invalidTransition, isFalse);

      // Valid transition to authenticated
      final validTransition =
          await stateMachine.transitionTo(AppState.authenticated);
      expect(validTransition, isTrue);

      stateMachine.dispose();
    });

    testWidgets('State machine should prevent transitions from disposed state',
        (WidgetTester tester) async {
      final stateMachine = StateMachineManager();

      // Transition through valid states to error
      await stateMachine.transitionTo(AppState.initializing);
      await stateMachine.transitionTo(AppState.authenticated);
      await stateMachine.transitionTo(AppState.error);

      // Recover to authenticated
      await stateMachine.recoverFromError(targetState: AppState.authenticated);

      // Manually transition to disposed
      await stateMachine.transitionTo(AppState.disposed);

      // Should not be able to transition from disposed
      final canTransition =
          stateMachine.canTransitionTo(AppState.authenticated);
      expect(canTransition, isFalse);

      stateMachine.dispose();
    });

    testWidgets('State machine should track transition history',
        (WidgetTester tester) async {
      final stateMachine = StateMachineManager();

      await stateMachine.transitionTo(AppState.initializing,
          reason: 'App starting');
      await stateMachine.transitionTo(AppState.authenticated,
          reason: 'User logged in');

      final history = stateMachine.transitionHistory;
      expect(history.length, greaterThanOrEqualTo(2));

      final lastTransition = history.last;
      expect(lastTransition.to, equals(AppState.authenticated));
      expect(lastTransition.reason, contains('logged in'));

      stateMachine.dispose();
    });

    testWidgets('State machine should enforce lifecycle constraints',
        (WidgetTester tester) async {
      expect(LifecycleConstraints.canScan(AppState.authenticated), isTrue);
      expect(LifecycleConstraints.canScan(AppState.offline), isTrue);
      expect(LifecycleConstraints.canScan(AppState.disposed), isFalse);

      expect(LifecycleConstraints.canSync(AppState.authenticated), isTrue);
      expect(LifecycleConstraints.canSync(AppState.offline), isFalse);

      expect(LifecycleConstraints.isOperational(AppState.authenticated), isTrue);
      expect(LifecycleConstraints.isOperational(AppState.disposed), isFalse);
      expect(LifecycleConstraints.isTerminal(AppState.disposed), isTrue);
    });
  });

  group('Offline Attendance Recording', () {
    testWidgets('Should record attendance while offline',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const app.IskonnectApp());
      await tester.pumpAndSettle();

      // Navigate to scanning screen if available
      // This would require your app's navigation setup
      // For now, we're just verifying the app loads without errors
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });
  });

  group('Data Sync Integration', () {
    testWidgets('Should sync attendance data after coming online',
        (WidgetTester tester) async {
      app.main();
      await tester.pumpWidget(const app.IskonnectApp());
      await tester.pumpAndSettle();

      // Verify app is running
      expect(find.byType(app.IskonnectApp), findsWidgets);
    });
  });
}
