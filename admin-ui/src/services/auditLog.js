// Records WHO changed a record and WHEN for the Audit Trail.
//
// Entries are written to Firestore `audit_logs` (readable now that the audit_logs
// read rule is deployed). The actor comes from the app-level session since this
// build authenticates to Firebase anonymously.
import { doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from './firebase';
import { getUsername, getRole } from '../utils/auth';

const LEGACY_LOCAL_KEY = 'ced-audit-logs';

// Remove the old per-browser mirror from previous builds so stale entries can't
// linger after the Firestore audit_logs collection is cleared.
try { localStorage.removeItem(LEGACY_LOCAL_KEY); } catch { /* ignore */ }

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function logAudit({ action, collection: targetCollection, documentId, details } = {}) {
  const id = makeId();
  const now = new Date().toISOString();
  const entry = {
    action: action || 'UPDATE',
    collection: targetCollection || null,
    documentId: documentId || null,
    details: { message: details || '' },
    userId: getUsername(),
    userEmail: getUsername(),
    userRole: getRole(),
    timestamp: now,
    createdAt: now,
  };

  try {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await setDoc(doc(db, 'audit_logs', id), entry);
  } catch (err) {
    console.warn('Audit log write failed:', err?.message);
  }
}
