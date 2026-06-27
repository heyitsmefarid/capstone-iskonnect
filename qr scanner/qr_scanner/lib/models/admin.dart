import 'package:hive/hive.dart';

part 'admin.g.dart';

/// Represents an administrator who uses the app for scanning.
@HiveType(typeId: 2)
class Admin extends HiveObject {
  /// Unique identifier for this admin
  @HiveField(0)
  final String id;

  /// Admin's display name
  @HiveField(1)
  final String name;

  /// Admin's email (optional)
  @HiveField(2)
  final String? email;

  /// Admin's department or role
  @HiveField(3)
  final String? department;

  /// When this admin was created
  @HiveField(4)
  final DateTime createdAt;

  Admin({
    required this.id,
    required this.name,
    this.email,
    this.department,
    required this.createdAt,
  });

  /// Creates a copy of this admin with updated fields
  Admin copyWith({
    String? id,
    String? name,
    String? email,
    String? department,
    DateTime? createdAt,
  }) {
    return Admin(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      department: department ?? this.department,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Converts to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'department': department,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Creates from JSON
  factory Admin.fromJson(Map<String, dynamic> json) {
    return Admin(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String?,
      department: json['department'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  @override
  String toString() {
    return 'Admin(id: $id, name: $name)';
  }
}
