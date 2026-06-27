class AssessmentModel {
  final String id;
  final String semester;
  final String academicYear;
  final double tuitionFee;
  final double miscellaneousFee;
  final double amountGranted;
  final double amountSpent;
  final DateTime assessmentDate;
  final String status; // Pending, Approved, Rejected

  AssessmentModel({
    required this.id,
    required this.semester,
    required this.academicYear,
    required this.tuitionFee,
    required this.miscellaneousFee,
    required this.amountGranted,
    required this.amountSpent,
    required this.assessmentDate,
    this.status = 'Pending',
  });

  double get remainingBalance => amountGranted - amountSpent;

  bool get isOverBudget => amountSpent > amountGranted;

  // Convenience getters for screen compatibility
  double get miscFee => miscellaneousFee;
  double get otherFee => 0; // No other fee in current model
  double get totalAssessment => tuitionFee + miscellaneousFee;
  double get balance => remainingBalance;
  DateTime get dateAssessed => assessmentDate;

  AssessmentModel copyWith({
    String? id,
    String? semester,
    String? academicYear,
    double? tuitionFee,
    double? miscellaneousFee,
    double? amountGranted,
    double? amountSpent,
    DateTime? assessmentDate,
    String? status,
  }) {
    return AssessmentModel(
      id: id ?? this.id,
      semester: semester ?? this.semester,
      academicYear: academicYear ?? this.academicYear,
      tuitionFee: tuitionFee ?? this.tuitionFee,
      miscellaneousFee: miscellaneousFee ?? this.miscellaneousFee,
      amountGranted: amountGranted ?? this.amountGranted,
      amountSpent: amountSpent ?? this.amountSpent,
      assessmentDate: assessmentDate ?? this.assessmentDate,
      status: status ?? this.status,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'semester': semester,
      'academicYear': academicYear,
      'tuitionFee': tuitionFee,
      'miscellaneousFee': miscellaneousFee,
      'amountGranted': amountGranted,
      'amountSpent': amountSpent,
      'assessmentDate': assessmentDate.toIso8601String(),
      'status': status,
    };
  }

  factory AssessmentModel.fromJson(Map<String, dynamic> json) {
    return AssessmentModel(
      id: json['id'],
      semester: json['semester'],
      academicYear: json['academicYear'],
      tuitionFee: json['tuitionFee'].toDouble(),
      miscellaneousFee: json['miscellaneousFee'].toDouble(),
      amountGranted: json['amountGranted'].toDouble(),
      amountSpent: json['amountSpent'].toDouble(),
      assessmentDate: DateTime.parse(json['assessmentDate']),
      status: json['status'] ?? 'Pending',
    );
  }
}

class AssessmentSummary {
  final double totalAmountGranted;
  final double totalAmountSpent;
  final int totalAssessments;

  AssessmentSummary({
    required this.totalAmountGranted,
    required this.totalAmountSpent,
    required this.totalAssessments,
  });

  double get remainingBalance => totalAmountGranted - totalAmountSpent;

  double get utilizationRate => totalAmountGranted > 0
      ? (totalAmountSpent / totalAmountGranted) * 100
      : 0;

  int get semestersWithAssessment => totalAssessments;

  factory AssessmentSummary.fromAssessments(List<AssessmentModel> assessments) {
    if (assessments.isEmpty) {
      return AssessmentSummary(
        totalAmountGranted: 0,
        totalAmountSpent: 0,
        totalAssessments: 0,
      );
    }

    final totalGranted = assessments.fold<double>(
      0,
      (sum, a) => sum + a.amountGranted,
    );
    final totalSpent = assessments.fold<double>(
      0,
      (sum, a) => sum + a.amountSpent,
    );

    return AssessmentSummary(
      totalAmountGranted: totalGranted,
      totalAmountSpent: totalSpent,
      totalAssessments: assessments.length,
    );
  }
}
