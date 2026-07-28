const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTemporaryPassword } = require('./temporaryPassword');

test('worked example: Dela Cruz, 2024-2025 -> delacruz@2024', () => {
  assert.equal(generateTemporaryPassword('Dela Cruz', '2024-2025'), 'delacruz@2024');
});

test('worked example: Santos, 2023-2024 -> santos@2023', () => {
  assert.equal(generateTemporaryPassword('Santos', '2023-2024'), 'santos@2023');
});

test('strips accents', () => {
  assert.equal(generateTemporaryPassword('Peña', '2025-2026'), 'pena@2025');
});

test('strips spaces and punctuation, forces lowercase', () => {
  assert.equal(generateTemporaryPassword("D'Angelo-Reyes", '2025-2026'), 'dangeloreyes@2025');
});

test('falls back to "scholar" when lastName is empty', () => {
  assert.equal(generateTemporaryPassword('', '2025-2026'), 'scholar@2025');
});

test('meets Firebase Auth\'s 6-character minimum for every realistic name', () => {
  assert.ok(generateTemporaryPassword('Li', '2025-2026').length >= 6);
});
