import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/message_attachment_model.dart';

void main() {
  group('MessageAttachment', () {
    test('round-trips through toJson/fromJson', () {
      const attachment = MessageAttachment(
        url: 'https://res.cloudinary.com/c42z63hb/raw/upload/v1/report.pdf',
        name: 'report.pdf',
      );

      final json = attachment.toJson();
      final restored = MessageAttachment.fromJson(json);

      expect(restored.url, attachment.url);
      expect(restored.name, attachment.name);
    });

    test('fromJson falls back to a default name when missing', () {
      final restored =
          MessageAttachment.fromJson({'url': 'https://example.com/f'});
      expect(restored.name, 'Attachment');
    });

    test('listFromJson handles null and empty input', () {
      expect(MessageAttachment.listFromJson(null), isEmpty);
      expect(MessageAttachment.listFromJson([]), isEmpty);
    });

    test('listFromJson parses a list of maps', () {
      final list = MessageAttachment.listFromJson([
        {'url': 'https://example.com/a.png', 'name': 'a.png'},
        {'url': 'https://example.com/b.pdf', 'name': 'b.pdf'},
      ]);
      expect(list, hasLength(2));
      expect(list[0].name, 'a.png');
      expect(list[1].url, 'https://example.com/b.pdf');
    });

    test('listToJson maps back to plain maps', () {
      const list = [
        MessageAttachment(url: 'https://example.com/a.png', name: 'a.png'),
      ];
      expect(MessageAttachment.listToJson(list), [
        {'url': 'https://example.com/a.png', 'name': 'a.png'},
      ]);
    });
  });
}
