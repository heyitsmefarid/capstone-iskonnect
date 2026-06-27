import 'dart:convert';
import 'package:uuid/uuid.dart';

/// User type enum to distinguish between scholars and applicants
enum StudentType {
  applicant, // Student applying for scholarship
  scholar, // Student who is already a scholar
}

class StudentModel {
  final String id;
  final String firstName;
  final String middleName;
  final String lastName;
  final String suffix;
  final String houseNo;
  final String street;
  final String barangay;
  final String city;
  final String province;
  final String gender;
  final DateTime dateOfBirth;
  final String contactNumber;
  final String email;
  final String password;
  final String schoolName;
  final String yearLevel;
  final String academicProgram;
  final String academicYear;
  final String semester;
  final String scholarshipStatus;
  final int semestersCompleted;
  // Per-semester grant set by the admin (program tuition cap). Used to total
  // the scholarship received across completed semesters.
  final double amountGranted;
  final DateTime createdAt;
  final String qrData;
  final StudentType studentType; // Distinguishes between scholar and applicant
  final String?
  applicationStatus; // For applicants: 'pending', 'for_exam', 'for_interview', 'approved', 'rejected'
  final String? profilePicture; // Base64 encoded profile picture or URL

  StudentModel({
    String? id,
    required this.firstName,
    required this.middleName,
    required this.lastName,
    this.suffix = '',
    this.houseNo = '',
    required this.street,
    required this.barangay,
    required this.city,
    required this.province,
    required this.gender,
    required this.dateOfBirth,
    required this.contactNumber,
    required this.email,
    required this.password,
    required this.schoolName,
    required this.yearLevel,
    required this.academicProgram,
    required this.academicYear,
    required this.semester,
    String? scholarshipStatus,
    this.semestersCompleted = 0,
    this.amountGranted = 0,
    DateTime? createdAt,
    String? qrData,
    this.studentType =
        StudentType.applicant, // Default to applicant for new registrations
    this.applicationStatus = 'pending', // Default application status
    this.profilePicture,
  }) : scholarshipStatus =
           scholarshipStatus ??
           (studentType == StudentType.scholar ? 'Active' : 'Pending'),
       id = id ?? _generateStudentId(),
       createdAt = createdAt ?? DateTime.now(),
       qrData = qrData ?? _generateQrData(id ?? _generateStudentId());

  static String _generateStudentId() {
    final uuid = const Uuid().v4();
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    return '${timestamp.substring(timestamp.length - 4)}${uuid.substring(0, 8).toUpperCase()}';
  }

  static String _generateQrData(String studentId) {
    return 'ISKONNECT:$studentId:${DateTime.now().millisecondsSinceEpoch}';
  }

  /// QR payload scanned by the admin attendance scanner. Encoded as JSON so the
  /// scanner can link a scan to this exact scholar via [id] (the Firestore
  /// `users` document id). Name/school/program are included for on-device
  /// display and offline records.
  String get qrDisplayData {
    return jsonEncode({
      'type': 'iskonnect_scholar',
      'id': id,
      'scholarId': id,
      'name': fullName,
      'school': schoolName,
      'program': academicProgram,
    });
  }

  String get fullName {
    final parts = <String>[firstName];
    if (middleName.isNotEmpty) {
      parts.add(middleName);
    }
    parts.add(lastName);
    if (suffix.isNotEmpty) {
      parts.add(suffix);
    }
    return parts.join(' ');
  }

  String get fullAddress {
    return '$houseNo $street, Brgy. $barangay, $city, $province';
  }

  int get age {
    final now = DateTime.now();
    int age = now.year - dateOfBirth.year;
    if (now.month < dateOfBirth.month ||
        (now.month == dateOfBirth.month && now.day < dateOfBirth.day)) {
      age--;
    }
    return age;
  }

  bool get isStAugustine => schoolName == 'St. Augustine Seminary';

  /// Check if student is a scholar (already approved)
  bool get isScholar => studentType == StudentType.scholar;

  /// Check if student is an applicant
  bool get isApplicant => studentType == StudentType.applicant;

  StudentModel copyWith({
    String? id,
    String? firstName,
    String? middleName,
    String? lastName,
    String? suffix,
    String? houseNo,
    String? street,
    String? barangay,
    String? city,
    String? province,
    String? gender,
    DateTime? dateOfBirth,
    String? contactNumber,
    String? email,
    String? password,
    String? schoolName,
    String? yearLevel,
    String? academicProgram,
    String? academicYear,
    String? semester,
    String? scholarshipStatus,
    int? semestersCompleted,
    double? amountGranted,
    DateTime? createdAt,
    String? qrData,
    StudentType? studentType,
    String? applicationStatus,
    String? profilePicture,
  }) {
    return StudentModel(
      id: id ?? this.id,
      firstName: firstName ?? this.firstName,
      middleName: middleName ?? this.middleName,
      lastName: lastName ?? this.lastName,
      suffix: suffix ?? this.suffix,
      houseNo: houseNo ?? this.houseNo,
      street: street ?? this.street,
      barangay: barangay ?? this.barangay,
      city: city ?? this.city,
      province: province ?? this.province,
      gender: gender ?? this.gender,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      contactNumber: contactNumber ?? this.contactNumber,
      email: email ?? this.email,
      password: password ?? this.password,
      schoolName: schoolName ?? this.schoolName,
      yearLevel: yearLevel ?? this.yearLevel,
      academicProgram: academicProgram ?? this.academicProgram,
      academicYear: academicYear ?? this.academicYear,
      semester: semester ?? this.semester,
      scholarshipStatus: scholarshipStatus ?? this.scholarshipStatus,
      semestersCompleted: semestersCompleted ?? this.semestersCompleted,
      amountGranted: amountGranted ?? this.amountGranted,
      createdAt: createdAt ?? this.createdAt,
      qrData: qrData ?? this.qrData,
      studentType: studentType ?? this.studentType,
      applicationStatus: applicationStatus ?? this.applicationStatus,
      profilePicture: profilePicture ?? this.profilePicture,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'firstName': firstName,
      'middleName': middleName,
      'lastName': lastName,
      'suffix': suffix,
      'houseNo': houseNo,
      'street': street,
      'barangay': barangay,
      'city': city,
      'province': province,
      'gender': gender,
      'dateOfBirth': dateOfBirth.toIso8601String(),
      'contactNumber': contactNumber,
      'email': email,
      'password': password,
      'schoolName': schoolName,
      'yearLevel': yearLevel,
      'academicProgram': academicProgram,
      'academicYear': academicYear,
      'semester': semester,
      'scholarshipStatus': scholarshipStatus,
      'semestersCompleted': semestersCompleted,
      'amountGranted': amountGranted,
      'createdAt': createdAt.toIso8601String(),
      'qrData': qrData,
      'studentType': studentType.name,
      'applicationStatus': applicationStatus,
      'profilePicture': profilePicture,
    };
  }

  factory StudentModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic v) {
      if (v == null) return DateTime.now();
      if (v is DateTime) return v;
      // Firestore Timestamp
      if (v is Map && v['seconds'] != null) {
        return DateTime.fromMillisecondsSinceEpoch((v['seconds'] as int) * 1000);
      }
      try { return DateTime.parse(v.toString()); } catch (_) { return DateTime.now(); }
    }

    return StudentModel(
      id: json['id']?.toString() ?? const Uuid().v4(),
      firstName: json['firstName']?.toString() ?? '',
      middleName: json['middleName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      suffix: json['suffix']?.toString() ?? '',
      houseNo: json['houseNo']?.toString() ?? '',
      street: json['street']?.toString() ?? '',
      barangay: json['barangay']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      province: json['province']?.toString() ?? '',
      gender: json['gender']?.toString() ?? '',
      dateOfBirth: parseDate(json['dateOfBirth']),
      contactNumber: json['contactNumber']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      password: json['password']?.toString() ?? '',
      schoolName: json['schoolName']?.toString() ?? '',
      yearLevel: json['yearLevel']?.toString() ?? '1',
      academicProgram: json['academicProgram']?.toString() ?? '',
      academicYear: json['academicYear']?.toString() ?? '',
      semester: json['semester']?.toString() ?? '1st Semester',
      scholarshipStatus: json['scholarshipStatus']?.toString(),
      semestersCompleted: (json['semestersCompleted'] as num?)?.toInt() ?? 0,
      amountGranted: (json['amountGranted'] as num?)?.toDouble() ?? 0,
      createdAt: parseDate(json['createdAt']),
      qrData: json['qrData']?.toString(),
      studentType: json['studentType'] == 'scholar'
          ? StudentType.scholar
          : StudentType.applicant,
      applicationStatus: json['applicationStatus']?.toString() ?? 'pending',
      profilePicture: json['profilePicture']?.toString(),
    );
  }
}
