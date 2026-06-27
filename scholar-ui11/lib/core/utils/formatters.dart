import 'package:intl/intl.dart';

class Formatters {
  // Date Formatters
  static String formatDate(DateTime date) {
    return DateFormat('MMMM d, yyyy').format(date);
  }

  static String formatDateShort(DateTime date) {
    return DateFormat('MMM d, yyyy').format(date);
  }

  static String formatDateNumeric(DateTime date) {
    return DateFormat('MM/dd/yyyy').format(date);
  }

  static String formatDateTime(DateTime dateTime) {
    return DateFormat('MMMM d, yyyy h:mm a').format(dateTime);
  }

  static String formatFullDate(DateTime date) {
    return DateFormat('EEEE, MMMM d, yyyy').format(date);
  }

  static String formatTime(DateTime time) {
    return DateFormat('h:mm a').format(time);
  }

  static String formatRelativeTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 365) {
      return '${(difference.inDays / 365).floor()} year(s) ago';
    } else if (difference.inDays > 30) {
      return '${(difference.inDays / 30).floor()} month(s) ago';
    } else if (difference.inDays > 0) {
      return '${difference.inDays} day(s) ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} hour(s) ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes} minute(s) ago';
    } else {
      return 'Just now';
    }
  }

  // Currency Formatters
  static String formatCurrency(double amount) {
    final formatter = NumberFormat('#,##0.00', 'en_PH');
    return formatter.format(amount);
  }

  static String formatCurrencyWithSymbol(double amount) {
    final formatter = NumberFormat.currency(
      locale: 'en_PH',
      symbol: '₱',
      decimalDigits: 2,
    );
    return formatter.format(amount);
  }

  static String formatCurrencyShort(double amount) {
    if (amount >= 1000000) {
      return '₱${(amount / 1000000).toStringAsFixed(1)}M';
    } else if (amount >= 1000) {
      return '₱${(amount / 1000).toStringAsFixed(1)}K';
    } else {
      return formatCurrency(amount);
    }
  }

  // Number Formatters
  static String formatNumber(int number) {
    return NumberFormat('#,###').format(number);
  }

  static String formatPercentage(double value, {int decimals = 1}) {
    return '${(value * 100).toStringAsFixed(decimals)}%';
  }

  // Name Formatters
  static String formatFullName({
    required String firstName,
    String? middleName,
    required String lastName,
    String? suffix,
  }) {
    final parts = <String>[firstName];
    if (middleName != null && middleName.isNotEmpty) {
      parts.add(middleName);
    }
    parts.add(lastName);
    if (suffix != null && suffix.isNotEmpty) {
      parts.add(suffix);
    }
    return parts.join(' ');
  }

  static String formatAddress({
    required String houseNo,
    required String street,
    required String barangay,
    required String city,
    required String province,
  }) {
    return '$houseNo $street, Brgy. $barangay, $city, $province';
  }

  // GWA Formatter
  static String formatGWA(double gwa) {
    return gwa.toStringAsFixed(2);
  }

  // Student ID Formatter
  static String formatStudentId(String id) {
    // Format: XXXX-XXXX-XXXX
    if (id.length != 12) return id;
    return '${id.substring(0, 4)}-${id.substring(4, 8)}-${id.substring(8, 12)}';
  }

  // Phone Number Formatter
  static String formatPhoneNumber(String phone) {
    // Format: +63 XXX XXX XXXX
    final cleaned = phone.replaceAll(RegExp(r'\D'), '');
    if (cleaned.length == 11 && cleaned.startsWith('0')) {
      return '+63 ${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}';
    } else if (cleaned.length == 12 && cleaned.startsWith('63')) {
      return '+${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}';
    }
    return phone;
  }

  // File Size Formatter
  static String formatFileSize(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
    }
  }

  // Academic Year Formatter
  static String formatAcademicYear(String academicYear, String semester) {
    return '$semester, A.Y. $academicYear';
  }

  // Semester Progress Formatter
  static String formatSemesterProgress(int completed, int total) {
    return '$completed / $total semesters completed';
  }
}
