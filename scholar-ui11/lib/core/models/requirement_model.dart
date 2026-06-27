class RequirementModel {
  final String id;
  final String name;
  final String description;
  final bool isRequired;
  final String status; // Pending, Submitted, Verified, Rejected
  final String? fileName;
  final int? fileSize;
  final String? fileType;
  final DateTime? submittedAt;
  final DateTime? verifiedAt;
  final String? remarks;

  RequirementModel({
    required this.id,
    required this.name,
    required this.description,
    required this.isRequired,
    this.status = 'Pending',
    this.fileName,
    this.fileSize,
    this.fileType,
    this.submittedAt,
    this.verifiedAt,
    this.remarks,
  });

  bool get isPending => status == 'Pending';
  bool get isSubmitted => status == 'Submitted';
  bool get isVerified => status == 'Verified';
  bool get isRejected => status == 'Rejected';

  // Alias for submittedAt
  DateTime? get uploadDate => submittedAt;

  RequirementModel copyWith({
    String? id,
    String? name,
    String? description,
    bool? isRequired,
    String? status,
    String? fileName,
    int? fileSize,
    String? fileType,
    DateTime? submittedAt,
    DateTime? verifiedAt,
    String? remarks,
  }) {
    return RequirementModel(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      isRequired: isRequired ?? this.isRequired,
      status: status ?? this.status,
      fileName: fileName ?? this.fileName,
      fileSize: fileSize ?? this.fileSize,
      fileType: fileType ?? this.fileType,
      submittedAt: submittedAt ?? this.submittedAt,
      verifiedAt: verifiedAt ?? this.verifiedAt,
      remarks: remarks ?? this.remarks,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'isRequired': isRequired,
      'status': status,
      'fileName': fileName,
      'fileSize': fileSize,
      'fileType': fileType,
      'submittedAt': submittedAt?.toIso8601String(),
      'verifiedAt': verifiedAt?.toIso8601String(),
      'remarks': remarks,
    };
  }

  factory RequirementModel.fromJson(Map<String, dynamic> json) {
    return RequirementModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      isRequired: json['isRequired'] ?? true,
      status: json['status'] ?? 'Pending',
      fileName: json['fileName'],
      fileSize: json['fileSize'],
      fileType: json['fileType'],
      submittedAt: json['submittedAt'] != null
          ? DateTime.parse(json['submittedAt'])
          : null,
      verifiedAt: json['verifiedAt'] != null
          ? DateTime.parse(json['verifiedAt'])
          : null,
      remarks: json['remarks'],
    );
  }
}

class RequirementsSummary {
  final int total;
  final int pending;
  final int submitted;
  final int verified;
  final int rejected;

  RequirementsSummary({
    required this.total,
    required this.pending,
    required this.submitted,
    required this.verified,
    required this.rejected,
  });

  double get completionRate => total > 0 ? (verified / total) * 100 : 0;

  double get progress => total > 0 ? verified / total : 0;

  int get notSubmitted => pending;

  bool get isComplete => verified == total;

  factory RequirementsSummary.fromRequirements(
    List<RequirementModel> requirements,
  ) {
    return RequirementsSummary(
      total: requirements.length,
      pending: requirements.where((r) => r.isPending).length,
      submitted: requirements.where((r) => r.isSubmitted).length,
      verified: requirements.where((r) => r.isVerified).length,
      rejected: requirements.where((r) => r.isRejected).length,
    );
  }
}
