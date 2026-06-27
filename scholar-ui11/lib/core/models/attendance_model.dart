class AttendanceModel {
  final String id;
  final String activityName;
  final DateTime date;
  final String status; // Present, Absent
  final String? remarks;

  AttendanceModel({
    required this.id,
    required this.activityName,
    required this.date,
    required this.status,
    this.remarks,
  });

  bool get isPresent => status == 'Present';
  bool get isAbsent => status == 'Absent';

  // Convenience getters for screen compatibility
  String? get timeIn => null; // No time tracking in current model
  String? get timeOut => null;

  AttendanceModel copyWith({
    String? id,
    String? activityName,
    DateTime? date,
    String? status,
    String? remarks,
  }) {
    return AttendanceModel(
      id: id ?? this.id,
      activityName: activityName ?? this.activityName,
      date: date ?? this.date,
      status: status ?? this.status,
      remarks: remarks ?? this.remarks,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'activityName': activityName,
      'date': date.toIso8601String(),
      'status': status,
      'remarks': remarks,
    };
  }

  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    return AttendanceModel(
      id: json['id'],
      activityName: json['activityName'],
      date: DateTime.parse(json['date']),
      status: json['status'],
      remarks: json['remarks'],
    );
  }
}

class AttendanceSummary {
  final int totalActivities;
  final int present;
  final int absent;
  final bool isTerminatedDueToAbsence;

  AttendanceSummary({
    required this.totalActivities,
    required this.present,
    required this.absent,
  }) : isTerminatedDueToAbsence = absent > 2;

  /// Returns attendance rate as a value between 0.0 and 1.0
  double get attendanceRate =>
      totalActivities > 0 ? (present / totalActivities) : 0;

  /// Returns attendance rate as a percentage (0-100)
  double get attendancePercentage => attendanceRate * 100;

  int get remainingAllowedAbsences => (2 - absent).clamp(0, 2);

  // Convenience getter for screen compatibility
  int get excused => 0; // No excused tracking in current model
}
