// Pushes the eligible HEIs (schools) and their programs into Firestore so the
// scholar app — which reads the `schools` and `programs` collections — shows the
// same official, eligible-only catalog as the admin. Existing docs are cleared
// first so non-eligible entries are removed.
//
// Requires the `schools`/`programs` write rules to allow the (anonymous) admin
// session — see firestore.rules.
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { initializeFirebase } from './firebase';
import { getCollection } from './localSettingsStore';

async function clearCollection(db, name) {
  const snap = await getDocs(collection(db, name));
  let batch = writeBatch(db);
  let ops = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops += 1;
    if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
  }
  if (ops > 0) await batch.commit();
}

// Mirrors the admin's current schools & programs (from System Settings) into the
// Firestore `schools`/`programs` collections that the scholar app reads. Pass the
// current lists, or it falls back to whatever is stored locally.
export async function syncCatalogToFirestore(schoolsArg, programsArg) {
  const { db, isReady } = initializeFirebase();
  if (!isReady || !db) throw new Error('Cloud database is not configured.');

  const schools = schoolsArg || getCollection('schools');
  const programs = programsArg || getCollection('programs');

  // Replace the existing catalog so non-eligible / removed entries are dropped.
  await clearCollection(db, 'schools');
  await clearCollection(db, 'programs');

  let batch = writeBatch(db);
  let ops = 0;
  const flush = async () => { if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; } };

  schools.forEach((s, i) => {
    if (!s?.name) return;
    batch.set(doc(collection(db, 'schools')), { name: s.name, order: i, active: s.active !== false });
    ops += 1;
  });
  if (ops > 0) await batch.commit();
  batch = writeBatch(db);
  ops = 0;

  let order = 0;
  for (const p of programs) {
    if (!p?.name) continue;
    batch.set(doc(collection(db, 'programs')), {
      name: p.name,
      school: p.school || '',
      tuitionCap: p.tuitionCap || 25000,
      order,
      active: p.active !== false,
    });
    order += 1;
    ops += 1;
    await flush();
  }
  if (ops > 0) await batch.commit();

  return { schools: schools.length, programs: programs.length };
}
