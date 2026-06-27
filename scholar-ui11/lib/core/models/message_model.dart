class MessageModel {
  final String id;
  final String content;
  final DateTime timestamp;
  final bool isFromStudent;
  final String status; // Sent, Seen, Replied
  final String? attachmentUrl;
  final String? attachmentName;

  MessageModel({
    required this.id,
    required this.content,
    required this.timestamp,
    required this.isFromStudent,
    this.status = 'Sent',
    this.attachmentUrl,
    this.attachmentName,
  });

  bool get isSent => status == 'Sent';
  bool get isSeen => status == 'Seen';
  bool get isReplied => status == 'Replied';
  bool get hasAttachment => attachmentUrl != null;

  MessageModel copyWith({
    String? id,
    String? content,
    DateTime? timestamp,
    bool? isFromStudent,
    String? status,
    String? attachmentUrl,
    String? attachmentName,
  }) {
    return MessageModel(
      id: id ?? this.id,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isFromStudent: isFromStudent ?? this.isFromStudent,
      status: status ?? this.status,
      attachmentUrl: attachmentUrl ?? this.attachmentUrl,
      attachmentName: attachmentName ?? this.attachmentName,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'isFromStudent': isFromStudent,
      'status': status,
      'attachmentUrl': attachmentUrl,
      'attachmentName': attachmentName,
    };
  }

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'],
      content: json['content'],
      timestamp: DateTime.parse(json['timestamp']),
      isFromStudent: json['isFromStudent'],
      status: json['status'] ?? 'Sent',
      attachmentUrl: json['attachmentUrl'],
      attachmentName: json['attachmentName'],
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
