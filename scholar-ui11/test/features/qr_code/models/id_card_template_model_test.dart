// scholar-ui11/test/features/qr_code/models/id_card_template_model_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

void main() {
  test('fromJson parses all fields when present', () {
    final model = IdCardTemplateModel.fromJson({
      'frontBackgroundUrl': 'https://example.com/front.png',
      'frontAspectRatio': 1.6,
      'backBackgroundUrl': 'https://example.com/back.png',
      'backAspectRatio': 1.6,
      'mayorName': 'Atty. Doy C. Leachon',
      'mayorSignatureUrl': 'https://example.com/sig.png',
      'primaryLogoUrl': 'https://example.com/logo1.png',
      'secondaryLogoUrl': 'https://example.com/logo2.png',
    });
    expect(model.frontBackgroundUrl, 'https://example.com/front.png');
    expect(model.frontAspectRatio, 1.6);
    expect(model.mayorName, 'Atty. Doy C. Leachon');
  });

  test('fromJson defaults aspect ratios to a sane fallback when missing', () {
    final model = IdCardTemplateModel.fromJson({
      'frontBackgroundUrl': 'https://example.com/front.png',
      'backBackgroundUrl': 'https://example.com/back.png',
    });
    expect(model.frontAspectRatio, 1.6);
    expect(model.backAspectRatio, 1.6);
  });

  test('fromJson treats missing background URLs as null (no active template usable)', () {
    final model = IdCardTemplateModel.fromJson({});
    expect(model.frontBackgroundUrl, isNull);
    expect(model.backBackgroundUrl, isNull);
  });
}
