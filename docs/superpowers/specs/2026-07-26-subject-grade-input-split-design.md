# Split subject creation from grade input (scholar app)

## Context

In the scholar-facing app (`scholar-ui11`), adding a subject and grading it are
currently one step. `AddGradeScreen` (`lib/features/grades/screens/add_grade_screen.dart`)
requires Course Code, Course Name, Units, **Grade**, and **Remarks** all at once
before the subject can be saved — the info banner even states "A grade is
required to submit."

This doesn't match how grading actually works: `GradeModel.grade` and
`.remarks` are already nullable and documented as "Set by admin, null if not
yet graded" (`lib/core/models/grade_model.dart:8-9`), and the rest of the app
(the "Pending" grade display, `isGraded`, the `currentTermGradesProvider`,
the GWA calculation) already fully supports a subject existing without a
grade yet. Only the creation screen forces grade/remarks in upfront.

Separately, `_SubjectCard` (`lib/features/grades/screens/grades_screen.dart`)
already has a per-subject "Edit" button that opens a dialog with all five
fields (code, name, units, grade, remarks) — this is effectively already the
"input grades later" mechanism the subject list needs; it just isn't labeled
or emphasized as such.

## Change 1 — Add Subject no longer collects grade/remarks

File: `scholar-ui11/lib/features/grades/screens/add_grade_screen.dart`

In the `!widget.corOnly && !widget.cogOnly` branch of `build()` (the "Add
Subject" form), remove:
- The `CustomTextField` for Grade (`_gradeController`, lines ~400-412).
- The `CustomDropdown<String>` for Remarks (`_selectedRemarks`, lines ~430-441).

Keep Course Code, Course Name, and Units exactly as they are.

Update the info banner text (line ~361) from:
> "Add your subject details. A grade is required to submit."

to:​
> "Add your subject details. You can input the grade once it's released."

Remove the now-unused state entirely: `_gradeController` (including its
`dispose()` call), `_selectedRemarks`, and `_remarksOptions`. `_selectedUnits`
and the `_units` list are unchanged (units stays part of subject creation).

`_handleSubmit` no longer parses a grade. It builds:

```dart
GradeModel(
  id: const Uuid().v4(),
  subjectCode: _subjectCodeController.text.trim().toUpperCase(),
  subjectName: _subjectNameController.text.trim(),
  semester: _selectedSemester,
  academicYear: _selectedAcademicYear,
  units: _selectedUnits,
  grade: null,
  remarks: null,
)
```

The success dialog and `_formKey` validation for Code/Name/Units are
unchanged — only the grade-related validation and controls are removed.

## Change 2 — Subject card button becomes grade-aware

File: `scholar-ui11/lib/features/grades/screens/grades_screen.dart`,
`_SubjectCard` (currently lines ~1408-1763).

The existing button that calls `_showEditDialog` (currently always styled as
"Edit," an info-blue `TextButton.icon`, shown whenever `!showGrade &&
!locked`) becomes state-dependent:

- **While `grade.grade == null`** (not yet graded): label **"Input Grade,"**
  icon `Icons.grade_outlined` (matches the Grade field's own icon elsewhere in
  this feature), styled with `AppColors.warning`/`AppColors.warningLight`
  instead of the current info-blue, so it visually stands out as an action
  the scholar still needs to take.
- **Once `grade.grade != null`** (already graded): unchanged from today —
  label "Edit," `AppColors.info`/`AppColors.infoLight`, `Icons.edit_outlined`.

Both states open the exact same `_showEditDialog` — no new dialog, no new
route. The dialog already collects code/name/units/grade/remarks together and
already requires a grade to save (`gradeController` validation at
lines ~1545-1553), which is correct for both "entering a grade for the first
time" and "correcting an existing one." The existing `locked` behavior (grade
editing disabled once the admin confirms the semester, shown via the lock
icon) is unchanged and applies to this button exactly as it does today.

## Out of scope

- No changes to `GradeModel`, `GradesNotifier` (`updateGrade`/`addGrade`/
  `_syncToFirestore`), or any Firestore document shape — the data layer
  already supports a null grade.
- No changes to the admin-side academic records pages (`admin-ui`) — this is
  scholar-side UI only.
- No changes to the "History" tab (`_PastGradesTab`) — it only shows already
  graded, non-current-period subjects (`showGrade: true`), which already
  hides the edit/input button entirely (`if (showGrade) const
  SizedBox.shrink()`); nothing here is graded.
- No changes to COR/COG upload flows in `add_grade_screen.dart` — those are
  separate branches of the same widget, untouched by this change.
