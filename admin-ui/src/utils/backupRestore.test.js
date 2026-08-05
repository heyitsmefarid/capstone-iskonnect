import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT_VERSION,
  buildBackupPayload,
  validateBackupFile,
  chunkArray,
} from './backupRestore.js';

test('buildBackupPayload sums documents across every collection', () => {
  const payload = buildBackupPayload(
    {
      users: [{ id: 'a' }, { id: 'b' }],
      school_years: [{ id: 'sy1' }],
      events: [],
    },
    { exportedAt: '2026-08-01T00:00:00.000Z', exportedBy: 'admin' }
  );

  assert.equal(payload.formatVersion, BACKUP_FORMAT_VERSION);
  assert.equal(payload.exportedAt, '2026-08-01T00:00:00.000Z');
  assert.equal(payload.exportedBy, 'admin');
  assert.equal(payload.totalDocuments, 3);
  assert.equal(payload.collections.users.length, 2);
  assert.equal(payload.collections.events.length, 0);
});

test('buildBackupPayload defaults exportedAt/exportedBy when omitted', () => {
  const payload = buildBackupPayload({ users: [{ id: 'a' }] });
  assert.equal(payload.exportedBy, null);
  assert.ok(typeof payload.exportedAt === 'string' && payload.exportedAt.length > 0);
});

test('validateBackupFile accepts a well-formed backup', () => {
  const result = validateBackupFile({
    exportedAt: '2026-08-01T00:00:00.000Z',
    exportedBy: 'admin',
    collections: {
      users: [{ id: 'u1', name: 'Test' }, { id: 'u2', name: 'Other' }],
      school_years: [{ id: 'sy1' }],
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.totalDocuments, 3);
  assert.equal(result.exportedAt, '2026-08-01T00:00:00.000Z');
  assert.equal(result.exportedBy, 'admin');
  assert.deepEqual(
    result.summary.sort((a, b) => a.name.localeCompare(b.name)),
    [
      { name: 'school_years', count: 1 },
      { name: 'users', count: 2 },
    ]
  );
});

test('validateBackupFile rejects non-object input', () => {
  assert.equal(validateBackupFile(null).valid, false);
  assert.equal(validateBackupFile(undefined).valid, false);
  assert.equal(validateBackupFile('not json').valid, false);
  assert.equal(validateBackupFile([1, 2, 3]).valid, false);
});

test('validateBackupFile rejects a file with no "collections" object', () => {
  const result = validateBackupFile({ exportedAt: '2026-08-01' });
  assert.equal(result.valid, false);
  assert.match(result.error, /collections/);
});

test('validateBackupFile rejects a document missing an id', () => {
  const result = validateBackupFile({
    collections: { users: [{ id: 'u1' }, { name: 'no id here' }] },
  });
  assert.equal(result.valid, false);
  assert.match(result.error, /users/);
});

test('validateBackupFile rejects an entirely empty backup', () => {
  const result = validateBackupFile({ collections: { users: [], events: [] } });
  assert.equal(result.valid, false);
  assert.match(result.error, /no collections/i);
});

test('validateBackupFile skips empty collections but still accepts non-empty ones', () => {
  const result = validateBackupFile({
    collections: { users: [{ id: 'u1' }], events: [] },
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.summary, [{ name: 'users', count: 1 }]);
});

test('chunkArray splits into groups no larger than the given size', () => {
  const items = Array.from({ length: 950 }, (_, i) => i);
  const chunks = chunkArray(items, 400);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 400);
  assert.equal(chunks[1].length, 400);
  assert.equal(chunks[2].length, 150);
});

test('chunkArray handles an empty or missing array', () => {
  assert.deepEqual(chunkArray([]), []);
  assert.deepEqual(chunkArray(undefined), []);
});

test('BACKUP_COLLECTIONS includes the core collections the app actually uses', () => {
  for (const name of ['users', 'school_years', 'system_config', 'audit_logs']) {
    assert.ok(BACKUP_COLLECTIONS.includes(name), `expected BACKUP_COLLECTIONS to include "${name}"`);
  }
});
