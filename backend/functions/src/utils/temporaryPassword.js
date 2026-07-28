'use strict';

function normalizeSurname(lastName) {
  return String(lastName || '')
    .normalize('NFD')            // decompose accented letters, e.g. "ñ" -> "n" + combining tilde
    .replace(/[^a-zA-Z]/g, '')   // strip everything that isn't a plain letter: the
                                  // now-detached accents, spaces, punctuation, digits
    .toLowerCase();
}

// Deliberately does NOT run through the app's password complexity policy
// (backend/functions/src/utils/passwordValidation.js) — that policy is for
// passwords a scholar CHOOSES during the forced first-change. This temp
// password only needs to clear Firebase Auth's own 6-character minimum,
// which every realistic surname + "@YYYY" clears by a wide margin.
function generateTemporaryPassword(lastName, grantSchoolYear) {
  const surname = normalizeSurname(lastName) || 'scholar';
  const startYear = String(grantSchoolYear).split('-')[0];
  return `${surname}@${startYear}`;
}

module.exports = { generateTemporaryPassword, normalizeSurname };
