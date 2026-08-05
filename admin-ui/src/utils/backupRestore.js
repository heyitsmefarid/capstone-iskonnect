// Collections included in a full database backup/restore. Covers every
// top-level collection the app reads or writes across AppContext.jsx and the
// pages that query Firestore directly — StaffManagement/UserManagement both
// read `users` too, so scholar/applicant AND staff/admin/viewer accounts are
// already covered by including it once (distinguished by their `role` field).
export const BACKUP_COLLECTIONS = [
  'users',
  'school_years',
  'schools',
  'programs',
  'announcements',
  'events',
  'messages',
  'group_chats',
  'system_config',
  'applicant_history',
  'scholar_history',
  'scholarship_applications',
  'audit_logs',
];

export const BACKUP_FORMAT_VERSION = 1;

// Assembles the JSON payload written to a backup file. `collectionsData` is
// { [collectionName]: Array<{ id, ...docData }> } — already-fetched
// documents, one entry per collection actually included.
export function buildBackupPayload(collectionsData, { exportedAt, exportedBy } = {}) {
  const collections = {};
  let totalDocuments = 0;
  for (const name of Object.keys(collectionsData || {})) {
    const docs = Array.isArray(collectionsData[name]) ? collectionsData[name] : [];
    collections[name] = docs;
    totalDocuments += docs.length;
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: exportedAt || new Date().toISOString(),
    exportedBy: exportedBy || null,
    totalDocuments,
    collections,
  };
}

// Validates a parsed backup file before any restore write happens. Returns
// { valid: true, summary, totalDocuments, exportedAt, exportedBy } or
// { valid: false, error }. Never throws — every field on `parsed` is read
// defensively since it comes from a file on disk, not our own code.
export function validateBackupFile(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Not a valid backup file (not a JSON object).' };
  }
  if (!parsed.collections || typeof parsed.collections !== 'object' || Array.isArray(parsed.collections)) {
    return { valid: false, error: 'Not a valid backup file — missing a "collections" object.' };
  }

  const summary = [];
  let totalDocuments = 0;
  for (const [name, docs] of Object.entries(parsed.collections)) {
    if (!Array.isArray(docs) || docs.length === 0) continue;
    const invalid = docs.some((d) => !d || typeof d !== 'object' || typeof d.id !== 'string' || d.id.length === 0);
    if (invalid) {
      return { valid: false, error: `Collection "${name}" has one or more entries missing a valid "id" field.` };
    }
    summary.push({ name, count: docs.length });
    totalDocuments += docs.length;
  }

  if (summary.length === 0) {
    return { valid: false, error: 'Backup file has no collections with any documents in them.' };
  }

  return {
    valid: true,
    summary,
    totalDocuments,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    exportedBy: typeof parsed.exportedBy === 'string' ? parsed.exportedBy : null,
  };
}

// Splits an array into Firestore-batch-safe chunks. The API caps a single
// batch at 500 writes; the rest of this codebase always commits well below
// that (see AppContext.jsx's bulk import / cleanupBlankRecords, both 400-450).
export function chunkArray(items, size = 400) {
  const chunks = [];
  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}
