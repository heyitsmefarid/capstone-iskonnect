import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/announcement_model.dart';
import 'package:iskonnectttt/core/models/message_attachment_model.dart';

void main() {
  group('AnnouncementModel attachments', () {
    test('toJson/fromJson round-trips a list of attachments', () {
      final announcement = AnnouncementModel(
        id: 'a1',
        title: 'Test',
        description: 'Body text',
        date: DateTime.utc(2026, 1, 1),
        attachments: const [
          MessageAttachment(url: 'https://example.com/a.png', name: 'a.png'),
          MessageAttachment(url: 'https://example.com/b.pdf', name: 'b.pdf'),
        ],
      );

      final json = announcement.toJson();
      final restored = AnnouncementModel.fromJson(json);

      expect(restored.attachments, hasLength(2));
      expect(restored.attachments[0].name, 'a.png');
      expect(restored.attachments[1].url, 'https://example.com/b.pdf');
    });

    test('fromJson defaults to an empty attachments list when missing', () {
      final restored = AnnouncementModel.fromJson({
        'id': 'a2',
        'title': 'Test',
        'description': 'Body',
        'date': DateTime.utc(2026, 1, 1).toIso8601String(),
      });

      expect(restored.attachments, isEmpty);
    });

    test('copyWith replaces the attachments list', () {
      final announcement = AnnouncementModel(
        id: 'a3',
        title: 'Test',
        description: 'Body',
        date: DateTime.utc(2026, 1, 1),
      );

      final updated = announcement.copyWith(
        attachments: const [
          MessageAttachment(url: 'https://example.com/c.docx', name: 'c.docx'),
        ],
      );

      expect(announcement.attachments, isEmpty);
      expect(updated.attachments, hasLength(1));
      expect(updated.attachments.single.name, 'c.docx');
    });
  });
}
