import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;
import 'package:iskonnectttt/core/models/event_model.dart';

/// Schedules a local notification the morning before each upcoming event, so
/// scholars get a reminder even if the app isn't open when it fires. Events
/// only carry a date (no time-of-day), so "24 hours before" is approximated
/// as 8:00 AM the day before — a reasonable hour rather than firing at
/// midnight.
class EventReminderService {
  static const _channelId = 'event_reminders';
  static const _channelName = 'Event Reminders';
  static const _channelDescription =
      'Reminders for scheduled events you need to attend';

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    tz_data.initializeTimeZones();
    tz.setLocalLocation(tz.local);

    // Monochrome silhouette — see announcement_notifications_native.dart: a
    // status-bar icon uses only its alpha, so the colour launcher icon would
    // show as a white square.
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

  /// Derives a stable 32-bit notification id from an event's Firestore doc
  /// id, so rescheduling on every app launch updates the same notification
  /// instead of creating duplicates.
  static int _notificationIdFor(String eventId) => eventId.hashCode & 0x7fffffff;

  static Future<void> scheduleReminders(List<EventModel> upcomingEvents) async {
    if (!_initialized) await init();

    final now = tz.TZDateTime.now(tz.local);
    for (final event in upcomingEvents) {
      final eventDay = tz.TZDateTime(
        tz.local,
        event.date.year,
        event.date.month,
        event.date.day,
      );
      final reminderTime =
          eventDay.subtract(const Duration(days: 1)).add(const Duration(hours: 8));

      if (!reminderTime.isAfter(now)) continue; // already passed, skip

      await _plugin.zonedSchedule(
        _notificationIdFor(event.id),
        'Upcoming Event',
        '${event.name} is tomorrow (${_formatDate(event.date)}).',
        reminderTime,
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
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
    }
  }

  static String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}
