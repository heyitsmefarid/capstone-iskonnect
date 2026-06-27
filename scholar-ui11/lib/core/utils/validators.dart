class Validators {
  static String? required(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return '${fieldName ?? 'This field'} is required';
    }
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Email is required';
    }
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );
    if (!emailRegex.hasMatch(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  }

  /// Lenient password check for the LOGIN screen — existing accounts may have
  /// older/simpler passwords, so we only require presence and a minimum length.
  static String? password(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  /// Strong password check for REGISTRATION and PASSWORD RESET — enforces a
  /// minimum length plus uppercase, lowercase, a number and a special character.
  /// Must mirror the server-side rule in passwordReset.js.
  static String? strongPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!RegExp(r'[A-Z]').hasMatch(value)) {
      return 'Add at least one uppercase letter';
    }
    if (!RegExp(r'[a-z]').hasMatch(value)) {
      return 'Add at least one lowercase letter';
    }
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Add at least one number';
    }
    if (!RegExp(r'[^A-Za-z0-9]').hasMatch(value)) {
      return 'Add at least one special character';
    }
    return null;
  }

  static String? confirmPassword(String? value, String password) {
    if (value == null || value.trim().isEmpty) {
      return 'Please confirm your password';
    }
    if (value != password) {
      return 'Passwords do not match';
    }
    return null;
  }

  static String? phoneNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Contact number is required';
    }
    // Philippine phone number format
    final phoneRegex = RegExp(r'^(09|\+639)\d{9}$');
    if (!phoneRegex.hasMatch(value.replaceAll(' ', '').replaceAll('-', ''))) {
      return 'Please enter a valid Philippine phone number';
    }
    return null;
  }

  static String? name(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return '${fieldName ?? 'Name'} is required';
    }
    if (value.trim().length < 2) {
      return '${fieldName ?? 'Name'} must be at least 2 characters';
    }
    final nameRegex = RegExp(r"^[a-zA-Z\s\-'\.]+$");
    if (!nameRegex.hasMatch(value)) {
      return '${fieldName ?? 'Name'} contains invalid characters';
    }
    return null;
  }

  static String? dropdown(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return 'Please select ${fieldName ?? 'an option'}';
    }
    return null;
  }

  static String? grade(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Grade is required';
    }
    final grade = double.tryParse(value);
    if (grade == null) {
      return 'Please enter a valid grade';
    }
    if (grade < 1.0 || grade > 5.0) {
      return 'Grade must be between 1.0 and 5.0';
    }
    return null;
  }

  static String? units(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Units is required';
    }
    final units = int.tryParse(value);
    if (units == null || units < 1 || units > 6) {
      return 'Units must be between 1 and 6';
    }
    return null;
  }

  static String? houseNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'House/Block/Lot number is required';
    }
    return null;
  }

  static String? street(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Street is required';
    }
    return null;
  }

  static String? dateOfBirth(DateTime? value) {
    if (value == null) {
      return 'Date of birth is required';
    }
    final now = DateTime.now();
    final age = now.year - value.year;
    if (age < 16 || age > 50) {
      return 'You must be between 16 and 50 years old';
    }
    return null;
  }
}
