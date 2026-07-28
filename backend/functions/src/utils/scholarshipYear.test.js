const test = require('node:test');
const assert = require('node:assert/strict');
const { computeGrantSchoolYear } = require('./scholarshipYear');

test('worked example from the spec: 2026-2027 1st Sem, 4 active semesters -> 2024-2025', () => {
  assert.equal(computeGrantSchoolYear(2026, 1, 4), '2024-2025');
});

test('second worked example shape: 1 active semester -> current school year unchanged', () => {
  assert.equal(computeGrantSchoolYear(2026, 1, 1), '2026-2027');
});

test('starting from 2nd semester steps back correctly', () => {
  // 2026-2027 2nd Sem, 3 active semesters: (2026,2)->(2026,1)->(2025,2) -> 2025-2026
  assert.equal(computeGrantSchoolYear(2026, 2, 3), '2025-2026');
});

test('activeSemesters <= 1 never steps backward (guards against 0 or negative input)', () => {
  assert.equal(computeGrantSchoolYear(2026, 1, 0), '2026-2027');
  assert.equal(computeGrantSchoolYear(2026, 1, -3), '2026-2027');
});

test('large semester counts step back multiple years', () => {
  // 2026-2027 1st Sem, 8 active semesters -> 7 steps back
  // (2026,1)->(2025,2)->(2025,1)->(2024,2)->(2024,1)->(2023,2)->(2023,1)->(2022,2)
  assert.equal(computeGrantSchoolYear(2026, 1, 8), '2022-2023');
});
