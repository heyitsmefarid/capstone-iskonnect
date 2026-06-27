import 'package:uuid/uuid.dart';

/// Represents a participant in a group chat
class GroupChatMember {
  final String id;
  final String name;
  final String? avatarUrl;
  final String school;
  final String program;
  final bool isAdmin;
  final DateTime joinedAt;

  GroupChatMember({
    required this.id,
    required this.name,
    this.avatarUrl,
    required this.school,
    required this.program,
    this.isAdmin = false,
    DateTime? joinedAt,
  }) : joinedAt = joinedAt ?? DateTime.now();

  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  GroupChatMember copyWith({
    String? id,
    String? name,
    String? avatarUrl,
    String? school,
    String? program,
    bool? isAdmin,
    DateTime? joinedAt,
  }) {
    return GroupChatMember(
      id: id ?? this.id,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      school: school ?? this.school,
      program: program ?? this.program,
      isAdmin: isAdmin ?? this.isAdmin,
      joinedAt: joinedAt ?? this.joinedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatarUrl': avatarUrl,
      'school': school,
      'program': program,
      'isAdmin': isAdmin,
      'joinedAt': joinedAt.toIso8601String(),
    };
  }

  factory GroupChatMember.fromJson(Map<String, dynamic> json) {
    return GroupChatMember(
      id: json['id'],
      name: json['name'],
      avatarUrl: json['avatarUrl'],
      school: json['school'],
      program: json['program'],
      isAdmin: json['isAdmin'] ?? false,
      joinedAt: json['joinedAt'] != null
          ? DateTime.parse(json['joinedAt'])
          : null,
    );
  }
}

/// Represents a message in a group chat
class GroupChatMessage {
  final String id;
  final String senderId;
  final String senderName;
  final String content;
  final DateTime timestamp;
  final String? attachmentUrl;
  final String? attachmentName;
  final List<String> readBy;
  final bool isSystemMessage;

  GroupChatMessage({
    String? id,
    required this.senderId,
    required this.senderName,
    required this.content,
    DateTime? timestamp,
    this.attachmentUrl,
    this.attachmentName,
    this.readBy = const [],
    this.isSystemMessage = false,
  }) : id = id ?? const Uuid().v4(),
       timestamp = timestamp ?? DateTime.now();

  bool get hasAttachment => attachmentUrl != null;

  String get senderInitials {
    final parts = senderName.split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return senderName.isNotEmpty ? senderName[0].toUpperCase() : '?';
  }

  GroupChatMessage copyWith({
    String? id,
    String? senderId,
    String? senderName,
    String? content,
    DateTime? timestamp,
    String? attachmentUrl,
    String? attachmentName,
    List<String>? readBy,
    bool? isSystemMessage,
  }) {
    return GroupChatMessage(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      attachmentUrl: attachmentUrl ?? this.attachmentUrl,
      attachmentName: attachmentName ?? this.attachmentName,
      readBy: readBy ?? this.readBy,
      isSystemMessage: isSystemMessage ?? this.isSystemMessage,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'senderId': senderId,
      'senderName': senderName,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'attachmentUrl': attachmentUrl,
      'attachmentName': attachmentName,
      'readBy': readBy,
      'isSystemMessage': isSystemMessage,
    };
  }

  factory GroupChatMessage.fromJson(Map<String, dynamic> json) {
    return GroupChatMessage(
      id: json['id'],
      senderId: json['senderId'],
      senderName: json['senderName'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      attachmentUrl: json['attachmentUrl'],
      attachmentName: json['attachmentName'],
      readBy: List<String>.from(json['readBy'] ?? []),
      isSystemMessage: json['isSystemMessage'] ?? false,
    );
  }
}

/// Represents a group chat
class GroupChat {
  final String id;
  final String name;
  final String? description;
  final String? avatarUrl;
  final List<GroupChatMember> members;
  final List<GroupChatMessage> messages;
  final DateTime createdAt;
  final String createdBy;
  final bool isSchoolGroup; // true if this is a school-specific group

  GroupChat({
    String? id,
    required this.name,
    this.description,
    this.avatarUrl,
    this.members = const [],
    this.messages = const [],
    DateTime? createdAt,
    required this.createdBy,
    this.isSchoolGroup = true,
  }) : id = id ?? const Uuid().v4(),
       createdAt = createdAt ?? DateTime.now();

  int get memberCount => members.length;

  int get unreadCount {
    // In a real app, this would be based on the current user's read status
    return 0;
  }

  GroupChatMessage? get lastMessage {
    if (messages.isEmpty) return null;
    return messages.last;
  }

  String get lastMessagePreview {
    final last = lastMessage;
    if (last == null) return 'No messages yet';
    if (last.isSystemMessage) return last.content;
    final preview = '${last.senderName.split(' ').first}: ${last.content}';
    return preview.length > 50 ? '${preview.substring(0, 47)}...' : preview;
  }

  GroupChat copyWith({
    String? id,
    String? name,
    String? description,
    String? avatarUrl,
    List<GroupChatMember>? members,
    List<GroupChatMessage>? messages,
    DateTime? createdAt,
    String? createdBy,
    bool? isSchoolGroup,
  }) {
    return GroupChat(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      members: members ?? this.members,
      messages: messages ?? this.messages,
      createdAt: createdAt ?? this.createdAt,
      createdBy: createdBy ?? this.createdBy,
      isSchoolGroup: isSchoolGroup ?? this.isSchoolGroup,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'avatarUrl': avatarUrl,
      'members': members.map((m) => m.toJson()).toList(),
      'messages': messages.map((m) => m.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'createdBy': createdBy,
      'isSchoolGroup': isSchoolGroup,
    };
  }

  factory GroupChat.fromJson(Map<String, dynamic> json) {
    return GroupChat(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      avatarUrl: json['avatarUrl'],
      members:
          (json['members'] as List?)
              ?.map((m) => GroupChatMember.fromJson(m))
              .toList() ??
          [],
      messages:
          (json['messages'] as List?)
              ?.map((m) => GroupChatMessage.fromJson(m))
              .toList() ??
          [],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : null,
      createdBy: json['createdBy'],
      isSchoolGroup: json['isSchoolGroup'] ?? true,
    );
  }
}

/// Types of chat conversations
enum ChatType {
  direct, // Direct message with CED Staff
  group, // Group chat with other scholars
}

/// Wrapper class for managing both direct and group chats
class ChatConversation {
  final String id;
  final ChatType type;
  final String name;
  final String? subtitle;
  final DateTime lastActivity;
  final int unreadCount;
  final String? lastMessagePreview;
  final String? avatarUrl;

  ChatConversation({
    required this.id,
    required this.type,
    required this.name,
    this.subtitle,
    required this.lastActivity,
    this.unreadCount = 0,
    this.lastMessagePreview,
    this.avatarUrl,
  });
}
