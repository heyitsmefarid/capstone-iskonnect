import 'package:flutter/material.dart';

/// Represents a milestone in the scholar's journey
enum ScholarshipMilestoneType {
  applicant,
  scholar,
  graduated,
  boardExamPasser,
  employed,
}

extension ScholarshipMilestoneTypeExtension on ScholarshipMilestoneType {
  String get displayName {
    switch (this) {
      case ScholarshipMilestoneType.applicant:
        return 'Applicant';
      case ScholarshipMilestoneType.scholar:
        return 'Scholar';
      case ScholarshipMilestoneType.graduated:
        return 'Graduated';
      case ScholarshipMilestoneType.boardExamPasser:
        return 'Board Exam Passer';
      case ScholarshipMilestoneType.employed:
        return 'Employed';
    }
  }

  String get description {
    switch (this) {
      case ScholarshipMilestoneType.applicant:
        return 'Started the journey by applying for the scholarship program';
      case ScholarshipMilestoneType.scholar:
        return 'Officially became a City Education Department scholar';
      case ScholarshipMilestoneType.graduated:
        return 'Successfully completed academic requirements and graduated';
      case ScholarshipMilestoneType.boardExamPasser:
        return 'Passed the professional licensure examination';
      case ScholarshipMilestoneType.employed:
        return 'Secured employment in their field of expertise';
    }
  }

  IconData get icon {
    switch (this) {
      case ScholarshipMilestoneType.applicant:
        return Icons.description_outlined;
      case ScholarshipMilestoneType.scholar:
        return Icons.school_outlined;
      case ScholarshipMilestoneType.graduated:
        return Icons.workspace_premium_outlined;
      case ScholarshipMilestoneType.boardExamPasser:
        return Icons.verified_outlined;
      case ScholarshipMilestoneType.employed:
        return Icons.work_outline;
    }
  }

  Color get color {
    switch (this) {
      case ScholarshipMilestoneType.applicant:
        return const Color(0xFF42A5F5); // Blue
      case ScholarshipMilestoneType.scholar:
        return const Color(0xFF66BB6A); // Green
      case ScholarshipMilestoneType.graduated:
        return const Color(0xFFAB47BC); // Purple
      case ScholarshipMilestoneType.boardExamPasser:
        return const Color(0xFFFFCA28); // Amber
      case ScholarshipMilestoneType.employed:
        return const Color(0xFF26A69A); // Teal
    }
  }

  int get sortOrder {
    switch (this) {
      case ScholarshipMilestoneType.applicant:
        return 0;
      case ScholarshipMilestoneType.scholar:
        return 1;
      case ScholarshipMilestoneType.graduated:
        return 2;
      case ScholarshipMilestoneType.boardExamPasser:
        return 3;
      case ScholarshipMilestoneType.employed:
        return 4;
    }
  }
}

class ScholarshipMilestone {
  final String id;
  final ScholarshipMilestoneType type;
  final DateTime date;
  final String? message;
  final bool isAchieved;

  ScholarshipMilestone({
    required this.id,
    required this.type,
    required this.date,
    this.message,
    this.isAchieved = true,
  });

  ScholarshipMilestone copyWith({
    String? id,
    ScholarshipMilestoneType? type,
    DateTime? date,
    String? message,
    bool? isAchieved,
  }) {
    return ScholarshipMilestone(
      id: id ?? this.id,
      type: type ?? this.type,
      date: date ?? this.date,
      message: message ?? this.message,
      isAchieved: isAchieved ?? this.isAchieved,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.name,
      'date': date.toIso8601String(),
      'message': message,
      'isAchieved': isAchieved,
    };
  }

  factory ScholarshipMilestone.fromJson(Map<String, dynamic> json) {
    return ScholarshipMilestone(
      id: json['id'],
      type: ScholarshipMilestoneType.values.firstWhere(
        (e) => e.name == json['type'],
      ),
      date: DateTime.parse(json['date']),
      message: json['message'],
      isAchieved: json['isAchieved'] ?? true,
    );
  }
}

class ScholarshipTimeline {
  final String scholarId;
  final List<ScholarshipMilestone> milestones;

  ScholarshipTimeline({required this.scholarId, required this.milestones});

  /// Get sorted milestones by type order
  List<ScholarshipMilestone> get sortedMilestones {
    final sorted = List<ScholarshipMilestone>.from(milestones);
    sorted.sort((a, b) => a.type.sortOrder.compareTo(b.type.sortOrder));
    return sorted;
  }

  /// Get the current milestone (last achieved)
  ScholarshipMilestone? get currentMilestone {
    final achieved = milestones.where((m) => m.isAchieved).toList();
    if (achieved.isEmpty) return null;
    achieved.sort((a, b) => b.type.sortOrder.compareTo(a.type.sortOrder));
    return achieved.first;
  }

  /// Get next milestone to achieve
  ScholarshipMilestoneType? get nextMilestone {
    final current = currentMilestone;
    if (current == null) return ScholarshipMilestoneType.applicant;

    final currentOrder = current.type.sortOrder;
    if (currentOrder >= ScholarshipMilestoneType.employed.sortOrder) {
      return null;
    }

    return ScholarshipMilestoneType.values.firstWhere(
      (t) => t.sortOrder == currentOrder + 1,
    );
  }

  /// Calculate progress percentage
  double get progressPercentage {
    final achieved = milestones.where((m) => m.isAchieved).length;
    return achieved / ScholarshipMilestoneType.values.length;
  }

  ScholarshipTimeline copyWith({
    String? scholarId,
    List<ScholarshipMilestone>? milestones,
  }) {
    return ScholarshipTimeline(
      scholarId: scholarId ?? this.scholarId,
      milestones: milestones ?? this.milestones,
    );
  }
}

/// Model for scholarship disbursement records
class ScholarshipDisbursement {
  final String id;
  final String semester;
  final String academicYear;
  final double amount;
  final DateTime disbursedDate;
  final String status; // 'disbursed', 'pending', 'processing'

  ScholarshipDisbursement({
    required this.id,
    required this.semester,
    required this.academicYear,
    required this.amount,
    required this.disbursedDate,
    this.status = 'disbursed',
  });

  ScholarshipDisbursement copyWith({
    String? id,
    String? semester,
    String? academicYear,
    double? amount,
    DateTime? disbursedDate,
    String? status,
  }) {
    return ScholarshipDisbursement(
      id: id ?? this.id,
      semester: semester ?? this.semester,
      academicYear: academicYear ?? this.academicYear,
      amount: amount ?? this.amount,
      disbursedDate: disbursedDate ?? this.disbursedDate,
      status: status ?? this.status,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'semester': semester,
      'academicYear': academicYear,
      'amount': amount,
      'disbursedDate': disbursedDate.toIso8601String(),
      'status': status,
    };
  }

  factory ScholarshipDisbursement.fromJson(Map<String, dynamic> json) {
    return ScholarshipDisbursement(
      id: json['id'],
      semester: json['semester'],
      academicYear: json['academicYear'],
      amount: json['amount'].toDouble(),
      disbursedDate: DateTime.parse(json['disbursedDate']),
      status: json['status'] ?? 'disbursed',
    );
  }
}
