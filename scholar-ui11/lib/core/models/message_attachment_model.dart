/// A single uploaded file attached to a chat message (Direct or Group).
class MessageAttachment {
  final String url;
  final String name;

  const MessageAttachment({required this.url, required this.name});

  Map<String, dynamic> toJson() => {'url': url, 'name': name};

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    return MessageAttachment(
      url: json['url']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Attachment',
    );
  }

  static List<MessageAttachment> listFromJson(List? json) {
    if (json == null) return const [];
    return json
        .map((e) =>
            MessageAttachment.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  static List<Map<String, dynamic>> listToJson(
      List<MessageAttachment> attachments) {
    return attachments.map((a) => a.toJson()).toList();
  }
}
