// backend/functions/src/utils/currentTerm.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurrentSchoolYearAndSemester } = require('./currentTerm');

// Minimal fake matching the .collection().where().limit().get() chain used
// by the implementation — no emulator needed for this pure lookup logic.
function fakeDb(activeYearDoc) {
  return {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            empty: !activeYearDoc,
            docs: activeYearDoc ? [{ data: () => activeYearDoc }] : [],
          }),
        }),
      }),
    }),
  };
}

test('returns yearStart + semesterIndex 1 for an active 1st semester', async () => {
  const db = fakeDb({
    startYear: 2026,
    isActive: true,
    semesters: [
      { name: '1st Semester', order: 1, isActive: true },
      { name: '2nd Semester', order: 2, isActive: false },
    ],
  });
  assert.deepEqual(await getCurrentSchoolYearAndSemester(db), { yearStart: 2026, semesterIndex: 1 });
});

test('returns semesterIndex 2 for an active 2nd semester', async () => {
  const db = fakeDb({
    startYear: 2026,
    isActive: true,
    semesters: [
      { name: '1st Semester', order: 1, isActive: false },
      { name: '2nd Semester', order: 2, isActive: true },
    ],
  });
  assert.deepEqual(await getCurrentSchoolYearAndSemester(db), { yearStart: 2026, semesterIndex: 2 });
});

test('returns null when no school year is marked active', async () => {
  assert.equal(await getCurrentSchoolYearAndSemester(fakeDb(null)), null);
});

test('returns null when the active year has no active semester', async () => {
  const db = fakeDb({
    startYear: 2026,
    isActive: true,
    semesters: [{ name: '1st Semester', order: 1, isActive: false }],
  });
  assert.equal(await getCurrentSchoolYearAndSemester(db), null);
});
