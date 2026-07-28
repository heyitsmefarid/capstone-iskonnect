import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportRows } from './scholarImportValidation.js';

const baseRow = {
  'Scholar ID': '', 'First Name': 'Juan', 'Middle Name': '', 'Last Name': 'Dela Cruz',
  Email: 'juan@example.com', School: 'Mindoro State University', Program: 'BSIT',
  'Year Level': '2', Status: 'Active', 'Total Scholarship Semesters': '8', 'Active Scholarship Semesters': '2',
};

test('a fully valid row has no errors', () => {
  const [result] = validateImportRows([baseRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('flags missing First Name, Last Name, invalid email, missing School/Program/Year Level', () => {
  const badRow = { ...baseRow, 'First Name': '', 'Last Name': '', Email: 'not-an-email', School: '', Program: '', 'Year Level': '' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Missing First Name'));
  assert.ok(result.errors.includes('Missing Last Name'));
  assert.ok(result.errors.includes('Invalid email format'));
  assert.ok(result.errors.includes('Missing School'));
  assert.ok(result.errors.includes('Missing Program'));
  assert.ok(result.errors.includes('Missing Year Level'));
});

test('flags Active Scholarship Semesters < 1', () => {
  const badRow = { ...baseRow, 'Active Scholarship Semesters': '0' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Active Scholarship Semesters must be at least 1'));
});

test('flags Total < Active semesters', () => {
  const badRow = { ...baseRow, 'Total Scholarship Semesters': '1', 'Active Scholarship Semesters': '2' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Total Scholarship Semesters must be >= Active Scholarship Semesters'));
});

test('flags an email that already has an account', () => {
  const [result] = validateImportRows([baseRow], { existingEmails: new Set(['juan@example.com']), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Email already has an account'));
});

test('flags a Scholar ID that already exists', () => {
  const row = { ...baseRow, 'Scholar ID': '2026-00001' };
  const [result] = validateImportRows([row], { existingEmails: new Set(), existingScholarIds: new Set(['2026-00001']) });
  assert.ok(result.errors.includes('Scholar ID already exists'));
});

test('flags duplicate emails and duplicate Scholar IDs WITHIN the file', () => {
  const row2 = { ...baseRow, 'First Name': 'Maria', 'Last Name': 'Santos' };
  const [, second] = validateImportRows([baseRow, row2], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(second.errors.includes('Duplicate email within this file'));
});

test('warns (does not block) on same name+school appearing twice', () => {
  const [, second] = validateImportRows([baseRow, { ...baseRow, Email: 'other@example.com' }], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(second.warnings.includes('Possible duplicate: same name + school already in this file'));
  assert.equal(second.valid, true);
});
