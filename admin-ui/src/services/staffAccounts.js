// Client-side staff/admin account management.
//
// This build runs on the Firebase Spark (free) plan (no Cloud Functions) and the
// admin UI talks to Firebase with anonymous auth, so accounts are stored in the
// Firestore `users` collection rather than Firebase Auth. Passwords are never
// stored in plain text — only a SHA-256 hash is kept, and login compares hashes.
// (For production, enable Email/Password auth and use real Firebase Auth users.)
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { initializeFirebase } from './firebase';

const PORTAL_ROLES = ['admin', 'super_admin', 'staff'];

const appRole = (role) => (role === 'admin' || role === 'super_admin' ? 'admin' : 'staff');

async function hashPassword(password) {
  const data = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// The Firestore `users` rules require a signed-in session; the admin UI signs in
// anonymously on boot, but make sure it's ready before we read/write.
async function ready() {
  const { auth, db, isReady } = initializeFirebase();
  if (!isReady || !db) throw new Error('Cloud database is not configured.');
  if (auth && !auth.currentUser) {
    try { await signInAnonymously(auth); } catch { /* listener will retry */ }
  }
  return db;
}

async function findPortalUsersByEmail(db, email) {
  const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => PORTAL_ROLES.includes(u.role));
}

// Creates a staff/admin account in Firestore (synced to every device).
export async function createStaffAccount({ email, password, displayName, role, position }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email is required.');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

  const db = await ready();

  const existing = await findPortalUsersByEmail(db, cleanEmail);
  if (existing.length > 0) throw new Error('An account with this email already exists.');

  const ref = doc(collection(db, 'users'));
  await setDoc(ref, {
    email: cleanEmail,
    displayName: displayName || cleanEmail,
    role,
    position: position || '',
    status: 'active',
    studentType: null, // a staff/admin account, not a scholar/applicant
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  });

  return { uid: ref.id };
}

// Activate / deactivate a staff account.
export async function setStaffStatus(uid, status) {
  const db = await ready();
  await setDoc(doc(db, 'users', uid), { status }, { merge: true });
}

// Reset a staff account's password (stores a new hash).
export async function resetStaffPassword(uid, newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const db = await ready();
  await setDoc(doc(db, 'users', uid), { passwordHash: await hashPassword(newPassword) }, { merge: true });
}

// Verifies email + password against the Firestore accounts and returns the
// portal role. Throws for invalid credentials, deactivated, or non-portal users.
export async function verifyLogin({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const db = await ready();

  const candidates = await findPortalUsersByEmail(db, cleanEmail);
  if (candidates.length === 0) throw new Error('Invalid username or password.');

  const passwordHash = await hashPassword(password);
  const user = candidates.find((u) => u.passwordHash && u.passwordHash === passwordHash);
  if (!user) throw new Error('Invalid username or password.');
  if (user.status === 'inactive') throw new Error('This account has been deactivated.');

  return {
    uid: user.id,
    role: appRole(user.role),
    displayName: user.displayName || cleanEmail,
  };
}
