// Statuses that keep a scholar in their school's auto-managed group chat.
export const AUTO_GROUP_STATUSES = ['approved', 'active', 'on-hold'];

// Groups applicants into { school -> sorted, deduped member ids } for every
// school that currently has at least one active scholar (AUTO_GROUP_STATUSES).
// Applicants without a school or a firestoreId are skipped — there is nothing
// to add them to, and no id to add.
export function computeDesiredSchoolMemberships(applicants) {
  const bySchool = new Map();
  (applicants || []).forEach((a) => {
    if (!AUTO_GROUP_STATUSES.includes(a.status)) return;
    if (!a.school || !a.firestoreId) return;
    if (!bySchool.has(a.school)) bySchool.set(a.school, new Set());
    bySchool.get(a.school).add(a.firestoreId);
  });

  const result = new Map();
  bySchool.forEach((idSet, school) => {
    result.set(school, Array.from(idSet).sort());
  });
  return result;
}

// True when `currentMemberIds` already matches `desiredMemberIds` (order-
// independent) — i.e. no Firestore write is needed.
export function membershipUnchanged(currentMemberIds, desiredMemberIds) {
  const current = [...(currentMemberIds || [])].sort();
  const desired = [...(desiredMemberIds || [])].sort();
  return current.length === desired.length && current.every((id, i) => id === desired[i]);
}

// Deterministic Firestore doc id for a school's auto-managed group, derived
// from the school name alone. This is the fix for a real duplicate-group bug:
// `applicants` and `group_chats` are two independent Firestore listeners with
// no ordering guarantee, so on a fresh page load the reconciliation effect can
// run with `applicants` already populated but `group_chats` still empty —
// "no group found yet" — and create a second one. Writing with `setDoc(...,
// {merge:true})` to this same predictable id instead of `addDoc` (which mints
// a random id every call) makes that create step idempotent: no matter how
// many times or from how many tabs/sessions it fires before the real doc is
// loaded, it converges on one doc instead of piling up duplicates.
export function autoGroupDocId(school) {
  const slug = String(school || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `auto-school-${slug}`;
}
