// Lightweight session/role helpers for the admin & staff panel.
// This build authenticates to Firebase anonymously, so the "who" for the UI is
// the app-level account stored here at login time.
//
// Sessions live in sessionStorage (not localStorage), so opening the app always
// requires a fresh login, the session ends when the tab/window is closed, and
// each tab can hold a different role (e.g. admin in one tab, staff in another).

const AUTH_KEY = 'admin-ui-auth';
const ROLE_KEY = 'admin-ui-role';
const NAME_KEY = 'admin-username';

// One-time migration: clear any old persistent login left in localStorage by a
// previous build so users aren't silently auto-logged-in anymore.
try {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
} catch { /* ignore */ }

export const ROLES = { ADMIN: 'admin', STAFF: 'staff' };

export const ROLE_LABELS = {
  admin: 'CED Administrator',
  staff: 'CED Staff',
};

export function setSession({ username, role }) {
  sessionStorage.setItem(AUTH_KEY, 'true');
  sessionStorage.setItem(ROLE_KEY, role);
  sessionStorage.setItem(NAME_KEY, username);
}

export function clearSession() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(NAME_KEY);
}

export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

export function getRole() {
  return sessionStorage.getItem(ROLE_KEY) || ROLES.ADMIN;
}

export function getUsername() {
  return sessionStorage.getItem(NAME_KEY) || 'Admin';
}

export function getRoleLabel() {
  return ROLE_LABELS[getRole()] || 'CED Staff';
}

export function isAdmin() {
  return getRole() === ROLES.ADMIN;
}
