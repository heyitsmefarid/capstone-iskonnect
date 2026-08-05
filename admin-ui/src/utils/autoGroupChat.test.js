import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDesiredSchoolMemberships, membershipUnchanged, autoGroupDocId } from './autoGroupChat.js';

const scholar = (overrides = {}) => ({
  status: 'active',
  school: 'Mindoro State University',
  firestoreId: 'fid-1',
  ...overrides,
});

test('groups active scholars by school', () => {
  const applicants = [
    scholar({ firestoreId: 'a1', school: 'MinSU' }),
    scholar({ firestoreId: 'a2', school: 'MinSU' }),
    scholar({ firestoreId: 'b1', school: 'PUP' }),
  ];
  const result = computeDesiredSchoolMemberships(applicants);
  assert.deepEqual(result.get('MinSU'), ['a1', 'a2']);
  assert.deepEqual(result.get('PUP'), ['b1']);
});

test('includes approved and on-hold scholars, not just active', () => {
  const applicants = [
    scholar({ firestoreId: 'a1', status: 'approved' }),
    scholar({ firestoreId: 'a2', status: 'on-hold' }),
  ];
  const result = computeDesiredSchoolMemberships(applicants);
  assert.deepEqual(result.get('Mindoro State University'), ['a1', 'a2']);
});

test('excludes applicants, rejected, terminated, and graduated', () => {
  const applicants = [
    scholar({ firestoreId: 'a1', status: 'pending' }),
    scholar({ firestoreId: 'a2', status: 'submitted' }),
    scholar({ firestoreId: 'a3', status: 'rejected' }),
    scholar({ firestoreId: 'a4', status: 'terminated' }),
    scholar({ firestoreId: 'a5', status: 'graduated' }),
  ];
  const result = computeDesiredSchoolMemberships(applicants);
  assert.equal(result.size, 0);
});

test('a school with zero active scholars has no entry at all', () => {
  const applicants = [scholar({ firestoreId: 'a1', status: 'terminated' })];
  const result = computeDesiredSchoolMemberships(applicants);
  assert.equal(result.has('Mindoro State University'), false);
});

test('skips scholars missing a school or a firestoreId', () => {
  const applicants = [
    scholar({ firestoreId: 'a1', school: '' }),
    scholar({ firestoreId: '', school: 'MinSU' }),
  ];
  const result = computeDesiredSchoolMemberships(applicants);
  assert.equal(result.size, 0);
});

test('dedupes and sorts member ids for a school', () => {
  const applicants = [
    scholar({ firestoreId: 'c3' }),
    scholar({ firestoreId: 'a1' }),
    scholar({ firestoreId: 'a1' }),
  ];
  const result = computeDesiredSchoolMemberships(applicants);
  assert.deepEqual(result.get('Mindoro State University'), ['a1', 'c3']);
});

test('membershipUnchanged is order-independent', () => {
  assert.equal(membershipUnchanged(['a', 'b'], ['b', 'a']), true);
  assert.equal(membershipUnchanged([], []), true);
});

test('membershipUnchanged detects additions and removals', () => {
  assert.equal(membershipUnchanged(['a'], ['a', 'b']), false);
  assert.equal(membershipUnchanged(['a', 'b'], ['a']), false);
});

test('membershipUnchanged treats a missing memberIds array as empty', () => {
  assert.equal(membershipUnchanged(undefined, []), true);
  assert.equal(membershipUnchanged(undefined, ['a']), false);
});

test('autoGroupDocId is deterministic for the same school name', () => {
  assert.equal(autoGroupDocId('Mindoro State University'), autoGroupDocId('Mindoro State University'));
});

test('autoGroupDocId differs for different schools', () => {
  assert.notEqual(autoGroupDocId('Mindoro State University'), autoGroupDocId('PUP'));
});

test('autoGroupDocId slugifies punctuation and spacing consistently', () => {
  assert.equal(autoGroupDocId('St. Anthony College Calapan City, Inc.'), 'auto-school-st-anthony-college-calapan-city-inc');
  assert.equal(autoGroupDocId('Luna Goco Colleges, Inc.'), 'auto-school-luna-goco-colleges-inc');
});

test('autoGroupDocId is stable regardless of incidental whitespace', () => {
  assert.equal(autoGroupDocId('  FRED SCHOOL  '), autoGroupDocId('FRED SCHOOL'));
});
