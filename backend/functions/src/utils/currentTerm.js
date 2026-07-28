'use strict';

async function getCurrentSchoolYearAndSemester(db) {
  const snap = await db.collection('school_years').where('isActive', '==', true).limit(1).get();
  if (snap.empty) return null;

  const yearDoc = snap.docs[0].data();
  const semesters = Array.isArray(yearDoc.semesters) ? yearDoc.semesters : [];
  const activeSemester = semesters.find((s) => s.isActive);
  if (!activeSemester) return null;

  const semesterIndex = Number(activeSemester.order) === 2 ? 2 : 1;
  return { yearStart: Number(yearDoc.startYear), semesterIndex };
}

module.exports = { getCurrentSchoolYearAndSemester };
