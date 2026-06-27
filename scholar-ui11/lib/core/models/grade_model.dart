class GradeModel {
  final String id;
  final String subjectName;
  final String subjectCode;
  final String semester;
  final String academicYear;
  final int units;
  final double? grade; // Set by admin, null if not yet graded
  final String? remarks; // Admin remarks/feedback

  GradeModel({
    required this.id,
    required this.subjectName,
    required this.subjectCode,
    required this.semester,
    required this.academicYear,
    this.units = 3,
    this.grade,
    this.remarks,
  });

  bool get isGraded => grade != null;

  bool get isPassed => grade != null && grade! <= 3.0 && grade! >= 1.0;

  bool get isFailed => grade != null && (grade! > 3.0 || grade! == 5.0);

  String get gradeDisplay {
    if (grade == null) return 'Pending';
    if (grade == 1.0) return '1.00';
    if (grade == 1.25) return '1.25';
    if (grade == 1.5) return '1.50';
    if (grade == 1.75) return '1.75';
    if (grade == 2.0) return '2.00';
    if (grade == 2.25) return '2.25';
    if (grade == 2.5) return '2.50';
    if (grade == 2.75) return '2.75';
    if (grade == 3.0) return '3.00';
    if (grade == 5.0) return '5.00';
    return grade!.toStringAsFixed(2);
  }

  String get gradeStatus {
    if (grade == null) return 'Not Yet Graded';
    if (grade! >= 1.0 && grade! <= 1.75) return 'Excellent';
    if (grade! >= 2.0 && grade! <= 2.5) return 'Good';
    if (grade! >= 2.75 && grade! <= 3.0) return 'Passed';
    if (grade! == 5.0) return 'Failed';
    return 'Invalid';
  }

  GradeModel copyWith({
    String? id,
    String? subjectName,
    String? subjectCode,
    String? semester,
    String? academicYear,
    int? units,
    double? grade,
    String? remarks,
  }) {
    return GradeModel(
      id: id ?? this.id,
      subjectName: subjectName ?? this.subjectName,
      subjectCode: subjectCode ?? this.subjectCode,
      semester: semester ?? this.semester,
      academicYear: academicYear ?? this.academicYear,
      units: units ?? this.units,
      grade: grade ?? this.grade,
      remarks: remarks ?? this.remarks,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'subjectName': subjectName,
      'subjectCode': subjectCode,
      'semester': semester,
      'academicYear': academicYear,
      'units': units,
      'grade': grade,
      'remarks': remarks,
    };
  }

  factory GradeModel.fromJson(Map<String, dynamic> json) {
    return GradeModel(
      id: json['id'],
      subjectName: json['subjectName'],
      subjectCode: json['subjectCode'],
      semester: json['semester'],
      academicYear: json['academicYear'],
      units: json['units'] ?? 3,
      grade: json['grade']?.toDouble(),
      remarks: json['remarks'],
    );
  }
}

class GradeSummary {
  final int totalSubjects;
  final int gradedSubjects;
  final int passedSubjects;
  final int failedSubjects;
  final int totalUnits;
  final int earnedUnits;
  final double? gwa; // General Weighted Average

  GradeSummary({
    required this.totalSubjects,
    required this.gradedSubjects,
    required this.passedSubjects,
    required this.failedSubjects,
    required this.totalUnits,
    required this.earnedUnits,
    this.gwa,
  });

  factory GradeSummary.fromGrades(List<GradeModel> grades) {
    final gradedSubjects = grades.where((g) => g.isGraded).toList();
    final passedSubjects = grades.where((g) => g.isPassed).length;
    final failedSubjects = grades.where((g) => g.isFailed).length;
    final totalUnits = grades.fold<int>(0, (sum, g) => sum + g.units);
    final earnedUnits = grades
        .where((g) => g.isPassed)
        .fold<int>(0, (sum, g) => sum + g.units);

    double? gwa;
    if (gradedSubjects.isNotEmpty) {
      double totalWeightedGrade = 0;
      int totalGradedUnits = 0;
      for (final g in gradedSubjects) {
        if (g.grade != null) {
          totalWeightedGrade += g.grade! * g.units;
          totalGradedUnits += g.units;
        }
      }
      if (totalGradedUnits > 0) {
        gwa = totalWeightedGrade / totalGradedUnits;
      }
    }

    return GradeSummary(
      totalSubjects: grades.length,
      gradedSubjects: gradedSubjects.length,
      passedSubjects: passedSubjects,
      failedSubjects: failedSubjects,
      totalUnits: totalUnits,
      earnedUnits: earnedUnits,
      gwa: gwa,
    );
  }

  String get gwaDisplay {
    if (gwa == null) return 'N/A';
    return gwa!.toStringAsFixed(2);
  }
}
