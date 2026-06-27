class AppConstants {
  // App Info
  static const String appName = 'Iskonnect';
  static const String appFullName = 'City Education Scholarship Program';
  static const String appVersion = '1.0.0';
  static const String city = 'Calapan City';
  static const String province = 'Oriental Mindoro';

  // Schools List
  static const List<String> schools = [
    'Divine Word College of Calapan',
    'Luna Goco Colleges, Inc.',
    'Southwestern College of Maritime, Business, and Technology',
    'St. Anthony College Calapan City, Inc.',
    'ACLC College of Calapan',
    'St. Mark Arts and Training Institute Inc.',
    'St. Augustine Seminary',
  ];

  // Special Schools (with different rules)
  static const String stAugustineSeminary = 'St. Augustine Seminary';

  // Year Levels
  static const List<String> yearLevels = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
  ];

  // Semesters
  static const List<String> semesters = ['1st Semester', '2nd Semester'];

  // Gender Options
  static const List<String> genders = ['Male', 'Female'];

  // Scholarship Status
  static const List<String> scholarshipStatuses = [
    'Active',
    'For Evaluation',
    'Terminated',
    'Extended',
  ];

  // Attendance Status
  static const List<String> attendanceStatuses = ['Present', 'Absent'];

  // Document Status
  static const List<String> documentStatuses = [
    'Pending',
    'Submitted',
    'Verified',
    'Rejected',
  ];

  // Max Values
  static const int maxSemesters = 8;
  static const int maxYears = 4;
  static const int maxAbsences = 2;

  // Supported File Types
  static const List<String> supportedFileTypes = ['pdf', 'jpg', 'jpeg', 'png'];
  static const int maxFileSizeInMB = 5;

  // Academic Years (generate dynamically in real app)
  static List<String> get academicYears {
    final currentYear = DateTime.now().year;
    return List.generate(5, (index) {
      final year = currentYear - index;
      return '$year-${year + 1}';
    });
  }

  // Barangays in Calapan City
  static const List<String> barangays = [
    'Balingayan',
    'Balite',
    'Batino',
    'Bayanan I',
    'Bayanan II',
    'Biga',
    'Bondoc',
    'Bucayao',
    'Buhuan',
    'Bulusan',
    'Calero',
    'Camansihan',
    'Camilmil',
    'Canubing I',
    'Canubing II',
    'Comunal',
    'Guinobatan',
    'Gulod',
    'Gutad',
    'Ibaba East',
    'Ibaba West',
    'Ilaya',
    'Lalud',
    'Lazareto',
    'Libis',
    'Lumang Bayan',
    'Mahal Na Pangalan',
    'Maidlang',
    'Malad',
    'Malamig',
    'Managpi',
    'Masipit',
    'Nag-Iba I',
    'Nag-Iba II',
    'Navotas',
    'Pachoca',
    'Palhi',
    'Panggalaan',
    'Parang',
    'Patas',
    'Personas',
    'Poblacion',
    'Punsulan',
    'San Antonio',
    'San Vicente',
    'Sapul',
    'Silonay',
    'Suqui',
    'Tawagan',
    'Tawiran',
    'Tibag',
    'Wawa',
  ];

  // Required Documents
  static const List<Map<String, dynamic>> requiredDocuments = [
    {
      'id': 'cor',
      'name': 'Certificate of Registration (COR)',
      'description': 'Latest COR from your school registrar',
      'required': true,
    },
    {
      'id': 'grades',
      'name': 'Report Card / Grades',
      'description': 'Previous semester grades',
      'required': true,
    },
    {
      'id': 'id_photo',
      'name': '2x2 ID Photo',
      'description': 'Recent 2x2 ID photo with white background',
      'required': true,
    },
    {
      'id': 'brgy_cert',
      'name': 'Barangay Certificate',
      'description': 'Certificate of residency from Calapan City barangay',
      'required': true,
    },
    {
      'id': 'birth_cert',
      'name': 'Birth Certificate',
      'description': 'PSA-authenticated birth certificate',
      'required': true,
    },
    {
      'id': 'income_cert',
      'name': 'Certificate of Low Income',
      'description': 'From DSWD or local social welfare office',
      'required': true,
    },
    {
      'id': 'good_moral',
      'name': 'Certificate of Good Moral',
      'description': 'From school guidance office',
      'required': true,
    },
    {
      'id': 'enrollment_form',
      'name': 'Enrollment Form',
      'description': 'Duly accomplished enrollment form',
      'required': true,
    },
  ];

  // Sample Academic Programs/Courses
  static const List<String> academicPrograms = [
    'Bachelor of Science in Information Technology',
    'Bachelor of Science in Computer Science',
    'Bachelor of Science in Business Administration',
    'Bachelor of Science in Accountancy',
    'Bachelor of Science in Nursing',
    'Bachelor of Science in Education',
    'Bachelor of Arts in Communication',
    'Bachelor of Science in Civil Engineering',
    'Bachelor of Science in Electrical Engineering',
    'Bachelor of Science in Marine Transportation',
    'Bachelor of Science in Marine Engineering',
    'Bachelor of Science in Hotel and Restaurant Management',
    'Bachelor of Science in Tourism Management',
    'Bachelor of Science in Criminology',
    'Bachelor of Science in Social Work',
    'Bachelor of Science in Psychology',
    'Associate in Computer Technology',
    'Diploma in Information Technology',
    'Philosophy (Seminary)',
    'Theology (Seminary)',
  ];

  // Eligible programs per partner HEI
  static const Map<String, List<String>> programsBySchool = {
    'Divine Word College of Calapan': [
      'Bachelor of Science in Psychology',
      'Bachelor of Secondary Education Major in Values Education',
      'Bachelor of Physical Education',
      'Bachelor of Science in Accountancy',
      'Bachelor of Science in Management Accounting',
      'Bachelor of Science in Civil Engineering',
      'Bachelor of Science in Computer Engineering',
      'Bachelor of Science in Electrical Engineering',
      'Bachelor of Science in Electronics Engineering',
      'Bachelor of Fine Arts',
      'Bachelor of Science in Architecture',
    ],
    'Luna Goco Colleges, Inc.': [
      'Bachelor of Science in Nursing',
      'Bachelor of Science in Medical Technology',
      'Bachelor of Science in Pharmacy',
      'Bachelor of Science in Radiologic Technology',
      'Bachelor of Science in Social Work',
      'Bachelor of Science in Midwifery',
      'Bachelor of Physical Therapy',
    ],
    'Southwestern College of Maritime, Business, and Technology': [
      'Bachelor of Science in Multimedia Arts',
      'Bachelor of Science in Entrepreneurship',
      'Bachelor of Science in Marine Transportation',
      'Bachelor of Science in Marine Engineering',
    ],
    'St. Anthony College Calapan City, Inc.': [
      'Bachelor of Science in Business Administration Major in Marketing Management',
      'Bachelor of Science in Business Administration Major in Financial Management',
    ],
    'ACLC College of Calapan': [
      'Bachelor of Science in Business Administration Major in Marketing Management',
    ],
    'St. Mark Arts and Training Institute Inc.': [
      'Tourism Leading to Maritime',
    ],
    'St. Augustine Seminary': ['Bachelor of Arts in Philosophy'],
  };
}
