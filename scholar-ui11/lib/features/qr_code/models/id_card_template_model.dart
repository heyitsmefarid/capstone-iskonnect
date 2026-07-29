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
      frontBackgroundUrl: json['frontBackgroundUrl']?.toString(),
      frontAspectRatio: (json['frontAspectRatio'] as num?)?.toDouble() ?? 1.6,
      backBackgroundUrl: json['backBackgroundUrl']?.toString(),
      backAspectRatio: (json['backAspectRatio'] as num?)?.toDouble() ?? 1.6,
      mayorName: json['mayorName']?.toString(),
      mayorSignatureUrl: json['mayorSignatureUrl']?.toString(),
      primaryLogoUrl: json['primaryLogoUrl']?.toString(),
      secondaryLogoUrl: json['secondaryLogoUrl']?.toString(),
    );
  }
}
