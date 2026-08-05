// Pure pass/fail helpers for a subject's grade record, shared by
// AcademicRecords.jsx's stats/sorting and its on-hold-notification triggers.
//
// "Passed" is defined by the Remarks field an admin explicitly selects when
// encoding a grade (Passed/Failed/Incomplete/Other) — not guessed from the
// numeric grade value. A blank/unset remarks value is treated as not-failing
// (legacy records only; the encode/edit forms always default remarks to
// 'Passed', so this only matters for pre-existing data missing the field).

export function isFailingSubject(subject) {
  const r = String(subject?.remarks || '').trim().toUpperCase();
  return r !== '' && r !== 'PASSED';
}

// True if any subject in any of the given term records is failing/incomplete/other.
export function gradesHaveFailure(termRecords) {
  return (termRecords || []).some((entry) => (entry.subjects || []).some(isFailingSubject));
}

export function getPassedSubjectsCount(subjects) {
  if (!subjects || subjects.length === 0) return 0;
  return subjects.filter((subject) => !isFailingSubject(subject)).length;
}
