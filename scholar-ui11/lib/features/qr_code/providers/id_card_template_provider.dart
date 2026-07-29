import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

/// Fetched once per screen visit (not a live stream) — the template changes
/// rarely, and a scholar can just re-open the ID card screen to see an update.
final idCardTemplateProvider = FutureProvider<IdCardTemplateModel?>((ref) async {
  try {
    final doc = await FirebaseFirestore.instance
        .collection('system_config')
        .doc('scholarIdCardTemplate')
        .get()
        .timeout(const Duration(seconds: 5));
    if (!doc.exists) return null;
    final data = doc.data();
    if (data == null || data['isActive'] != true) return null;
    return IdCardTemplateModel.fromJson(data);
  } catch (_) {
    return null;
  }
});
