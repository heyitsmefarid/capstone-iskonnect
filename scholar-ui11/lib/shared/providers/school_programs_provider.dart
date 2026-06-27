import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/constants/app_constants.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';

final schoolsProvider = FutureProvider<List<String>>((ref) async {
  final remote = await ScholarFirestoreService.fetchSchools();
  if (remote.isNotEmpty) return remote;
  return AppConstants.schools;
});

final programsProvider = FutureProvider<List<String>>((ref) async {
  final remote = await ScholarFirestoreService.fetchPrograms();
  if (remote.isNotEmpty) return remote;
  return AppConstants.academicPrograms;
});

// School name → its programs. Lets registration show only the programs offered
// by the chosen school instead of every program in the system.
final programsBySchoolProvider =
    FutureProvider<Map<String, List<String>>>((ref) async {
  final remote = await ScholarFirestoreService.fetchProgramsBySchool();
  if (remote.isNotEmpty) return remote;
  return AppConstants.programsBySchool;
});
