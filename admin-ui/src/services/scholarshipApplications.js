// Reads the full BFCSP application record that the scholar app writes to the
// Firestore `scholarship_applications` collection. The admin `applicants` list
// (sourced from the `users` collection) only carries a subset of fields, so we
// look the full record up on demand — e.g. when generating the printable form.

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'scholarship_applications';

// Prefer a submitted application, then the most recently saved one.
function pickBest(records) {
  if (records.length === 0) return null;
  const score = (r) => (r.status === 'submitted' ? 2 : r.status === 'under_review' ? 1 : 0);
  return [...records].sort((a, b) => {
    const s = score(b) - score(a);
    if (s !== 0) return s;
    return String(b.savedAt || '').localeCompare(String(a.savedAt || ''));
  })[0];
}

async function queryBy(field, value) {
  if (!value) return [];
  const snap = await getDocs(query(collection(db, COLLECTION), where(field, '==', value)));
  return snap.docs.map((d) => ({ firestoreId: d.id, ...d.data() }));
}

/**
 * Fetch the full BFCSP record for an admin applicant, or null if none / Firebase
 * isn't configured. Matches on the scholar's user id first, then email.
 */
export async function fetchBfcspApplication(applicant) {
  if (!db || !applicant) return null;

  const userId = applicant.firestoreId || applicant.userId;
  const email = applicant.email || applicant.emailAddress;

  try {
    let records = await queryBy('userId', userId);
    if (records.length === 0) records = await queryBy('emailAddress', email);
    return pickBest(records);
  } catch (error) {
    // Permission denied / offline / not configured — caller falls back to the
    // admin applicant's own fields.
    console.warn('Could not load full BFCSP application:', error?.message || error);
    return null;
  }
}
