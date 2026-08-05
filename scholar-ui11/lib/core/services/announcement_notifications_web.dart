// ignore_for_file: deprecated_member_use
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

bool _permissionRequested = false;

Future<void> initAnnouncementNotifications() async {
  if (_permissionRequested) return;
  _permissionRequested = true;
  if (html.Notification.supported) {
    await html.Notification.requestPermission();
  }
}

Future<void> showAnnouncementNotification({
  required int id,
  required String title,
  required String body,
}) async {
  if (!html.Notification.supported) return;
  if (!_permissionRequested) await initAnnouncementNotifications();
  if (html.Notification.permission != 'granted') return;
  html.Notification(title, body: body);
}
