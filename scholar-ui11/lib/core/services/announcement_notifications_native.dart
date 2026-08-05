import 'package:flutter_local_notifications/flutter_local_notifications.dart';

const _channelId = 'announcements';
const _channelName = 'Announcements';
const _channelDescription = 'New announcements from CED';

final _plugin = FlutterLocalNotificationsPlugin();
bool _initialized = false;

Future<void> initAnnouncementNotifications() async {
  if (_initialized) return;
  _initialized = true;

  // Must be a monochrome silhouette, not the launcher icon: Android uses only
  // the alpha channel of a status-bar icon and paints every opaque pixel white,
  // so the full-colour launcher artwork renders as a solid white square.
  const androidSettings = AndroidInitializationSettings(
    '@drawable/ic_stat_notification',
  );
  const iosSettings = DarwinInitializationSettings();
  await _plugin.initialize(
    const InitializationSettings(android: androidSettings, iOS: iosSettings),
  );

  await _plugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.requestNotificationsPermission();
  await _plugin
      .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>()
      ?.requestPermissions(alert: true, badge: true, sound: true);
}

Future<void> showAnnouncementNotification({
  required int id,
  required String title,
  required String body,
}) async {
  if (!_initialized) await initAnnouncementNotifications();
  await _plugin.show(
    id,
    title,
    body,
    const NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    ),
  );
}
