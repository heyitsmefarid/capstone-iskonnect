import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/router/app_router.dart';

void main() {
  test('redirects to change-password when required and not already there', () {
    expect(
      mustChangePasswordRedirectTarget(mustChangePassword: true, onChangePasswordScreen: false),
      '/change-password',
    );
  });

  test('does not redirect when already on the change-password screen', () {
    expect(
      mustChangePasswordRedirectTarget(mustChangePassword: true, onChangePasswordScreen: true),
      isNull,
    );
  });

  test('does not redirect when a password change is not required', () {
    expect(
      mustChangePasswordRedirectTarget(mustChangePassword: false, onChangePasswordScreen: false),
      isNull,
    );
  });
}
