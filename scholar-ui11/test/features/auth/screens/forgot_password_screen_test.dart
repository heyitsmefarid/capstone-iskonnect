import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/auth/screens/forgot_password_screen.dart';

// No provider overrides needed: the screen reads authStateProvider only inside
// its button handler, so simply building it never reaches Firebase.
Future<void> _pumpForgotPassword(WidgetTester tester) {
  return tester.pumpWidget(
    const ProviderScope(
      child: MaterialApp(home: ForgotPasswordScreen()),
    ),
  );
}

void main() {
  testWidgets('collects only an email address, never a code or new password',
      (tester) async {
    await _pumpForgotPassword(tester);
    await tester.pumpAndSettle();

    expect(find.text('Email Address'), findsOneWidget);
    expect(find.text('Send Reset Link'), findsOneWidget);

    // Firebase Auth emails a reset link and the new password is chosen on
    // Firebase's own page. The app cannot set another user's password without
    // a reset token or the Admin SDK, so collecting one here would be dead
    // input - the exact bug this flow used to have.
    expect(find.byType(TextFormField), findsOneWidget);
    expect(find.text('6-Digit Code'), findsNothing);
    expect(find.text('New Password'), findsNothing);
    expect(find.text('Confirm New Password'), findsNothing);
    expect(find.text('Resend Code'), findsNothing);
  });
}
