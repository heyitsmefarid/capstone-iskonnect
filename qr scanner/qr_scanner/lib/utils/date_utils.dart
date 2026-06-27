import 'package:intl/intl.dart';

/// Utility class for date and time formatting
class DateTimeUtils {
  static final DateFormat _dateFormat = DateFormat('MMM dd, yyyy');
  static final DateFormat _timeFormat = DateFormat('hh:mm a');
  static final DateFormat _dateTimeFormat = DateFormat(
    'MMM dd, yyyy • hh:mm a',
  );
  static final DateFormat _shortDateFormat = DateFormat('MMM dd');
  static final DateFormat _isoDateFormat = DateFormat('yyyy-MM-dd');

  /// Format date to readable string (e.g., "Jan 15, 2026")
  static String formatDate(DateTime date) {
    return _dateFormat.format(date);
  }

  /// Format time to readable string (e.g., "02:30 PM")
  static String formatTime(DateTime date) {
    return _timeFormat.format(date);
  }

  /// Format date and time together
  static String formatDateTime(DateTime date) {
    return _dateTimeFormat.format(date);
  }

  /// Format to short date (e.g., "Jan 15")
  static String formatShortDate(DateTime date) {
    return _shortDateFormat.format(date);
  }

  /// Format to ISO date string (e.g., "2026-01-15")
  static String formatIsoDate(DateTime date) {
    return _isoDateFormat.format(date);
  }

  /// Get relative time string (e.g., "2 minutes ago", "Yesterday")
  static String getRelativeTime(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inSeconds < 60) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      final minutes = difference.inMinutes;
      return '$minutes ${minutes == 1 ? 'minute' : 'minutes'} ago';
    } else if (difference.inHours < 24) {
      final hours = difference.inHours;
      return '$hours ${hours == 1 ? 'hour' : 'hours'} ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return formatDate(date);
    }
  }

  /// Check if a date is today
  static bool isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }

  /// Check if a date is yesterday
  static bool isYesterday(DateTime date) {
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    return date.year == yesterday.year &&
        date.month == yesterday.month &&
        date.day == yesterday.day;
  }

  /// Get display label for a date (Today, Yesterday, or formatted date)
  static String getDateLabel(DateTime date) {
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return formatDate(date);
    }
  }

  /// Parse ISO date string
  static DateTime? parseIsoDate(String dateString) {
    try {
      return DateTime.parse(dateString);
    } catch (e) {
      return null;
    }
  }
}
