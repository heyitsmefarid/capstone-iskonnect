import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/services/storage_service.dart';

void main() {
  group('StorageService.isFileSizeAllowed', () {
    test('allows a file at exactly the 10 MB cap', () {
      expect(StorageService.isFileSizeAllowed(10 * 1024 * 1024), isTrue);
    });

    test('rejects a file over the 10 MB cap', () {
      expect(
          StorageService.isFileSizeAllowed(10 * 1024 * 1024 + 1), isFalse);
    });

    test('rejects an empty file', () {
      expect(StorageService.isFileSizeAllowed(0), isFalse);
    });

    test('allows a small file', () {
      expect(StorageService.isFileSizeAllowed(1024), isTrue);
    });
  });
}
