import test from 'node:test';
import assert from 'node:assert/strict';

// auth.js reads/writes sessionStorage (and does a one-time localStorage
// cleanup at import time, already guarded by its own try/catch). Neither
// exists in plain Node, so stub both before the functions under test are
// ever called — the module itself can load fine either way.
class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
}
globalThis.sessionStorage = new MemoryStorage();
globalThis.localStorage = new MemoryStorage();

const { ROLES, setSession, clearSession, getRole, getRoleLabel, isAdmin, canEdit } =
  await import('./auth.js');

test('defaults to admin when no session is set', () => {
  clearSession();
  assert.equal(getRole(), ROLES.ADMIN);
});

test('canEdit is true for admin and staff', () => {
  setSession({ username: 'a', role: ROLES.ADMIN });
  assert.equal(canEdit(), true);
  setSession({ username: 's', role: ROLES.STAFF });
  assert.equal(canEdit(), true);
});

test('canEdit is false for viewer — this is the whole point of the role', () => {
  setSession({ username: 'v', role: ROLES.VIEWER });
  assert.equal(canEdit(), false);
});

test('isAdmin is only true for the admin role', () => {
  setSession({ username: 'v', role: ROLES.VIEWER });
  assert.equal(isAdmin(), false);
  setSession({ username: 's', role: ROLES.STAFF });
  assert.equal(isAdmin(), false);
  setSession({ username: 'a', role: ROLES.ADMIN });
  assert.equal(isAdmin(), true);
});

test('getRoleLabel reflects the viewer role', () => {
  setSession({ username: 'v', role: ROLES.VIEWER });
  assert.equal(getRoleLabel(), 'CED Viewer');
});
