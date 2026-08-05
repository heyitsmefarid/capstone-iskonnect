import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/announcement_model.dart';
import 'package:iskonnectttt/features/announcements/providers/announcements_provider.dart';

AnnouncementModel _buildAnnouncement(String id) {
  return AnnouncementModel(
    id: id,
    title: 'Announcement $id',
    description: 'Body $id',
    date: DateTime(2026, 7, 27),
  );
}

void main() {
  test('returns announcements whose id is not in knownIds', () {
    final current = [_buildAnnouncement('a'), _buildAnnouncement('b')];

    final result = newAnnouncementsSince(current, {'a'});

    expect(result, hasLength(1));
    expect(result.single.id, 'b');
  });

  test('returns everything when knownIds is empty', () {
    final current = [_buildAnnouncement('a'), _buildAnnouncement('b')];

    final result = newAnnouncementsSince(current, {});

    expect(result, hasLength(2));
  });

  test('returns nothing when every id is already known', () {
    final current = [_buildAnnouncement('a'), _buildAnnouncement('b')];

    final result = newAnnouncementsSince(current, {'a', 'b'});

    expect(result, isEmpty);
  });
}
