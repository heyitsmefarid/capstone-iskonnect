/// The admin-configured ID card template (system_config/scholarIdCardTemplate).
/// A null [frontBackgroundUrl]/[backBackgroundUrl] means no template has been
/// activated yet — callers should fall back to a plain, template-less card.
class IdCardTemplateModel {
  final String? frontBackgroundUrl;
  final double frontAspectRatio;
  final String? backBackgroundUrl;
  final double backAspectRatio;
  final String? mayorName;
  final String? mayorSignatureUrl;
  final String? primaryLogoUrl;
  final String? secondaryLogoUrl;

  const IdCardTemplateModel({
    this.frontBackgroundUrl,
    this.frontAspectRatio = 1.6,
    this.backBackgroundUrl,
    this.backAspectRatio = 1.6,
    this.mayorName,
    this.mayorSignatureUrl,
    this.primaryLogoUrl,
    this.secondaryLogoUrl,
  });

  factory IdCardTemplateModel.fromJson(Map<String, dynamic> json) {
    return IdCardTemplateModel(
      frontBackgroundUrl: _nullIfEmpty(json['frontBackgroundUrl']),
      frontAspectRatio: (json['frontAspectRatio'] as num?)?.toDouble() ?? 1.6,
      backBackgroundUrl: _nullIfEmpty(json['backBackgroundUrl']),
      backAspectRatio: (json['backAspectRatio'] as num?)?.toDouble() ?? 1.6,
      mayorName: _nullIfEmpty(json['mayorName']),
      mayorSignatureUrl: _nullIfEmpty(json['mayorSignatureUrl']),
      primaryLogoUrl: _nullIfEmpty(json['primaryLogoUrl']),
      secondaryLogoUrl: _nullIfEmpty(json['secondaryLogoUrl']),
    );
  }

  // An admin can save the template form with a field left blank (e.g.
  // activate before uploading every image, or before naming the mayor),
  // which round-trips through Firestore as `''`, not absent. `''` is
  // non-null, so every `!= null` guard in this model's consumers (and the
  // "no active template" fallback in qr_code_screen.dart) would otherwise
  // treat a blank field as "present" and try to render it.
  static String? _nullIfEmpty(dynamic v) {
    final s = v?.toString().trim();
    return (s == null || s.isEmpty) ? null : s;
  }
}
