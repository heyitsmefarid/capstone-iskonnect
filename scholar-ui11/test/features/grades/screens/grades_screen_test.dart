import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/grade_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/grades/screens/grades_screen.dart';

GradeModel _buildGrade({double? grade}) {
  return GradeModel(
    id: 'g1',
    subjectName: 'Intro to Computing',
    subjectCode: 'IT101',
    semester: '1st Semester',
    academicYear: '2025-2026',
    grade: grade,
  );
}

void main() {
  test('ungraded subject gets the highlighted "Input Grade" action', () {
    final style = subjectActionButtonStyle(_buildGrade(grade: null));
    expect(style.label, 'Input Grade');
    expect(style.icon, Icons.grade_outlined);
    expect(style.foreground, AppColors.warning);
    expect(style.background, AppColors.warningLight);
  });

  test('graded subject gets the plain "Edit" action', () {
    final style = subjectActionButtonStyle(_buildGrade(grade: 1.5));
    expect(style.label, 'Edit');
    expect(style.icon, Icons.edit_outlined);
    expect(style.foreground, AppColors.info);
    expect(style.background, AppColors.infoLight);
  });
}
