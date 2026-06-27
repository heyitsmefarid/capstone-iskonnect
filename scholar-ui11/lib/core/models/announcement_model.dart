/// Enum to define announcement visibility
enum AnnouncementVisibility {
  all, // Visible to both scholars and applicants
  scholarsOnly, // Only visible to approved scholars
  applicantsOnly, // Only visible to applicants (scholarship exam schedules, etc.)
}

class AnnouncementModel {
  final String id;
  final String title;
  final String description;
  final DateTime date;
  final String? imageUrl;
  final List<String> attachments;
  final bool isImportant;
  final bool isRead;
  final AnnouncementVisibility visibility;

  // Alias for description
  String get content => description;

  AnnouncementModel({
    required this.id,
    required this.title,
    required this.description,
    required this.date,
    this.imageUrl,
    this.attachments = const [],
    this.isImportant = false,
    this.isRead = false,
    this.visibility = AnnouncementVisibility.all,
  });

  AnnouncementModel copyWith({
    String? id,
    String? title,
    String? description,
    DateTime? date,
    String? imageUrl,
    List<String>? attachments,
    bool? isImportant,
    bool? isRead,
    AnnouncementVisibility? visibility,
  }) {
    return AnnouncementModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      date: date ?? this.date,
      imageUrl: imageUrl ?? this.imageUrl,
      attachments: attachments ?? this.attachments,
      isImportant: isImportant ?? this.isImportant,
      isRead: isRead ?? this.isRead,
      visibility: visibility ?? this.visibility,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'date': date.toIso8601String(),
      'imageUrl': imageUrl,
      'attachments': attachments,
      'isImportant': isImportant,
      'isRead': isRead,
      'visibility': visibility.name,
    };
  }

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    return AnnouncementModel(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      date: DateTime.parse(json['date']),
      imageUrl: json['imageUrl'],
      attachments: List<String>.from(json['attachments'] ?? []),
      isImportant: json['isImportant'] ?? false,
      isRead: json['isRead'] ?? false,
      visibility: AnnouncementVisibility.values.firstWhere(
        (e) => e.name == json['visibility'],
        orElse: () => AnnouncementVisibility.all,
      ),
    );
  }
}
