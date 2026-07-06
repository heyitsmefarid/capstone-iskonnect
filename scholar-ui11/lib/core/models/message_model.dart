import 'message_attachment_model.dart';

class MessageModel {
  final String id;
  final String content;
  final DateTime timestamp;
  final bool isFromStudent;
  final String status; // Sent, Seen, Replied
  final List<MessageAttachment> attachments;

  MessageModel({
    required this.id,
    required this.content,
    required this.timestamp,
    required this.isFromStudent,
    this.status = 'Sent',
    this.attachments = const [],
  });

  bool get isSent => status == 'Sent';
  bool get isSeen => status == 'Seen';
  bool get isReplied => status == 'Replied';
  bool get hasAttachment => attachments.isNotEmpty;

  MessageModel copyWith({
    String? id,
    String? content,
    DateTime? timestamp,
    bool? isFromStudent,
    String? status,
    List<MessageAttachment>? attachments,
  }) {
    return MessageModel(
      id: id ?? this.id,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isFromStudent: isFromStudent ?? this.isFromStudent,
      status: status ?? this.status,
      attachments: attachments ?? this.attachments,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'isFromStudent': isFromStudent,
      'status': status,
      'attachments': MessageAttachment.listToJson(attachments),
    };
  }

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      isFromStudent: json['isFromStudent'],
      status: json['status'] ?? 'Sent',
      attachments: MessageAttachment.listFromJson(json['attachments'] as List?),
    );
  }
}

class ConversationModel {
  final String id;
  final String subject;
  final List<MessageModel> messages;
  final DateTime lastMessageAt;
  final bool hasUnread;

  ConversationModel({
    required this.id,
    required this.subject,
    required this.messages,
    required this.lastMessageAt,
    this.hasUnread = false,
  });

  String get lastMessagePreview {
    if (messages.isEmpty) return '';
    return messages.last.content.length > 50
        ? '${messages.last.content.substring(0, 50)}...'
        : messages.last.content;
  }

  ConversationModel copyWith({
    String? id,
    String? subject,
    List<MessageModel>? messages,
    DateTime? lastMessageAt,
    bool? hasUnread,
  }) {
    return ConversationModel(
      id: id ?? this.id,
      subject: subject ?? this.subject,
      messages: messages ?? this.messages,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      hasUnread: hasUnread ?? this.hasUnread,
    );
  }
}
