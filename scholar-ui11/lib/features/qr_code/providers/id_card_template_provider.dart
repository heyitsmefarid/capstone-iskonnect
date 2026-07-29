import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

/// Fetched fresh each time something is actually watching it (not a live
/// stream) — `autoDispose` drops the cached value once the QR screen
/// unmounts, so re-opening the screen re-fetches instead of showing a
/// value cached for the app's whole lifetime. The template changes rarely,
/// so this is not a live stream while the screen stays open.
final idCardTemplateProvider = FutureProvider.autoDispose<IdCardTemplateModel?>((ref) async {
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
