import 'package:hive/hive.dart';

part 'event.g.dart';

/// Represents an event or activity for attendance tracking.
@HiveType(typeId: 1)
class Event extends HiveObject {
  /// Unique identifier for this event
  @HiveField(0)
  final String id;

  /// Name of the event
  @HiveField(1)
  final String name;

  /// Optional description of the event
  @HiveField(2)
  final String? description;

  /// Date of the event
  @HiveField(3)
  final DateTime date;

  /// Whether this event is currently active for scanning
  @HiveField(4)
  bool isActive;

  /// When this event was created
  @HiveField(5)
  final DateTime createdAt;

  Event({
    required this.id,
    required this.name,
    this.description,
    required this.date,
    this.isActive = true,
    required this.createdAt,
  });

  /// Creates a copy of this event with updated fields
  Event copyWith({
    String? id,
    String? name,
    String? description,
    DateTime? date,
    bool? isActive,
    DateTime? createdAt,
  }) {
    return Event(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      date: date ?? this.date,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Converts this event to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'date': date.toIso8601String(),
      'isActive': isActive,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Creates an event from JSON
  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      date: DateTime.parse(json['date'] as String),
      isActive: json['isActive'] as bool? ?? true,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  @override
  String toString() {
    return 'Event(id: $id, name: $name, date: $date, active: $isActive)';
  }
}
