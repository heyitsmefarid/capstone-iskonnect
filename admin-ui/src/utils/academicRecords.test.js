import test from 'node:test';
import assert from 'node:assert/strict';
import { isFailingSubject, gradesHaveFailure, getPassedSubjectsCount } from './academicRecords.js';

test('isFailingSubject is false only for an explicit "Passed" remark', () => {
  assert.equal(isFailingSubject({ remarks: 'Passed' }), false);
  assert.equal(isFailingSubject({ remarks: 'passed' }), false); // case-insensitive
  assert.equal(isFailingSubject({ remarks: '  Passed  ' }), false); // trims whitespace
});

test('isFailingSubject is true for Failed, Incomplete, and Other', () => {
  assert.equal(isFailingSubject({ remarks: 'Failed' }), true);
  assert.equal(isFailingSubject({ remarks: 'Incomplete' }), true);
  assert.equal(isFailingSubject({ remarks: 'Other' }), true);
});

test('isFailingSubject does not use the numeric grade at all — remarks decides', () => {
  // A low (good) numeric grade with a non-Passed remark must still fail —
  // this was the actual bug: the old numeric-only check let this through as
  // "passed" purely because the grade value looked good.
  assert.equal(isFailingSubject({ remarks: 'Incomplete', grade: 1.0 }), true);
  // A high (bad) numeric grade with an explicit Passed remark still counts as
  // passed — remarks is authoritative either direction.
  assert.equal(isFailingSubject({ remarks: 'Passed', grade: 5.0 }), false);
});

test('isFailingSubject treats a blank/unset remarks as not-failing (legacy data)', () => {
  assert.equal(isFailingSubject({}), false);
  assert.equal(isFailingSubject({ remarks: '' }), false);
});

test('gradesHaveFailure is true when any subject in any term record is failing', () => {
  const records = [
    { subjects: [{ remarks: 'Passed' }, { remarks: 'Incomplete' }] },
  ];
  assert.equal(gradesHaveFailure(records), true);
});

test('gradesHaveFailure is false when every subject passed', () => {
  const records = [
    { subjects: [{ remarks: 'Passed' }] },
    { subjects: [{ remarks: 'Passed' }] },
  ];
  assert.equal(gradesHaveFailure(records), false);
});

test('gradesHaveFailure handles missing/empty records', () => {
  assert.equal(gradesHaveFailure([]), false);
  assert.equal(gradesHaveFailure(undefined), false);
  assert.equal(gradesHaveFailure([{}]), false); // record with no subjects array
});

test('getPassedSubjectsCount counts only explicitly-Passed subjects', () => {
  const subjects = [
    { remarks: 'Passed' },
    { remarks: 'Passed' },
    { remarks: 'Failed' },
    { remarks: 'Incomplete' },
    { remarks: 'Other' },
  ];
  assert.equal(getPassedSubjectsCount(subjects), 2);
});

test('getPassedSubjectsCount is 0 for an empty or missing subject list', () => {
  assert.equal(getPassedSubjectsCount([]), 0);
  assert.equal(getPassedSubjectsCount(undefined), 0);
});
