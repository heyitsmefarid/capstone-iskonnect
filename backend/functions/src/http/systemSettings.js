const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

async function listCollection(db, col) {
  const snap = await db.collection(col).orderBy('order', 'asc').get().catch(() =>
    db.collection(col).get()
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// GET /getSystemSettings
exports.getSystemSettings = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });

    const { db } = getFirebaseAdmin();

    const [schools, programs, categories, statuses, stages, config] = await Promise.all([
      listCollection(db, COLLECTIONS.SCHOOLS),
      listCollection(db, COLLECTIONS.PROGRAMS),
      listCollection(db, COLLECTIONS.SCHOLARSHIP_CATEGORIES),
      listCollection(db, COLLECTIONS.SCHOLARSHIP_STATUSES),
      listCollection(db, COLLECTIONS.TIMELINE_STAGES),
      db.collection(COLLECTIONS.SYSTEM_CONFIG).doc('main').get(),
    ]);

    return res.json({
      schools,
      programs,
      categories,
      statuses,
      stages,
      config: config.exists ? config.data() : {},
    });
  } catch (err) {
    console.error('getSystemSettings error:', err);
    return handleError(res, err, 'systemSettings');
  }
});

// POST /updateSystemConfig
exports.updateSystemConfig = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { db } = getFirebaseAdmin();
    const updates = req.body || {};

    await db.collection(COLLECTIONS.SYSTEM_CONFIG).doc('main').set(
      { ...updates, updatedAt: new Date().toISOString(), updatedBy: ctx.user.uid },
      { merge: true }
    );

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: 'UPDATE',
      collection: COLLECTIONS.SYSTEM_CONFIG,
      documentId: 'main',
      details: 'System config updated',
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('updateSystemConfig error:', err);
    return handleError(res, err, 'systemSettings');
  }
});

// POST /manageSettingsItem - CRUD for schools, programs, categories, statuses, stages
exports.manageSettingsItem = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { db } = getFirebaseAdmin();
    const { collection: col, action, id, data } = req.body || {};

    const allowedCollections = [
      COLLECTIONS.SCHOOLS,
      COLLECTIONS.PROGRAMS,
      COLLECTIONS.SCHOLARSHIP_CATEGORIES,
      COLLECTIONS.SCHOLARSHIP_STATUSES,
      COLLECTIONS.TIMELINE_STAGES,
    ];

    if (!allowedCollections.includes(col)) {
      return res.status(400).json({ error: 'Invalid collection' });
    }

    let docId = id;
    const now = new Date().toISOString();

    if (action === 'create') {
      const ref = db.collection(col).doc();
      docId = ref.id;
      await ref.set({ ...data, createdAt: now, createdBy: ctx.user.uid, active: true });
    } else if (action === 'update') {
      if (!docId) return res.status(400).json({ error: 'id required for update' });
      await db.collection(col).doc(docId).update({ ...data, updatedAt: now, updatedBy: ctx.user.uid });
    } else if (action === 'delete') {
      if (!docId) return res.status(400).json({ error: 'id required for delete' });
      await db.collection(col).doc(docId).delete();
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: action.toUpperCase(),
      collection: col,
      documentId: docId,
      details: `Settings item ${action}d in ${col}`,
    });

    return res.json({ success: true, id: docId });
  } catch (err) {
    console.error('manageSettingsItem error:', err);
    return handleError(res, err, 'systemSettings');
  }
});

// POST /seedDefaultSettings
exports.seedDefaultSettings = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (ctx.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Super admin only' });
    }

    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    const now = new Date().toISOString();

    const defaultSchools = [
      { name: 'Divine Word College', code: 'DWC', tuitionCap: 25000, order: 1, active: true },
      { name: 'Luna Colleges', code: 'LUNA', tuitionCap: 25000, order: 2, active: true },
      { name: 'South Colleges', code: 'SOUTH', tuitionCap: 25000, order: 3, active: true },
      { name: 'St. Mark College', code: 'STM', tuitionCap: 25000, order: 4, active: true },
      { name: 'St. Anthony College', code: 'STA', tuitionCap: 25000, order: 5, active: true },
      { name: 'ACLC College', code: 'ACLC', tuitionCap: 25000, order: 6, active: true },
      { name: 'St. Augustine Academy', code: 'SAA', tuitionCap: 25000, order: 7, active: true, gradesOnly: true },
    ];

    const defaultPrograms = [
      { name: 'Bachelor of Science in Nursing', code: 'BSN', order: 1, active: true },
      { name: 'Bachelor of Science in Information Technology', code: 'BSIT', order: 2, active: true },
      { name: 'Bachelor of Science in Computer Science', code: 'BSCS', order: 3, active: true },
      { name: 'Bachelor of Science in Education', code: 'BSEd', order: 4, active: true },
      { name: 'Bachelor of Science in Accountancy', code: 'BSA', order: 5, active: true },
      { name: 'Bachelor of Science in Business Administration', code: 'BSBA', order: 6, active: true },
      { name: 'Bachelor of Science in Criminology', code: 'BSCrim', order: 7, active: true },
      { name: 'Bachelor of Science in Engineering', code: 'BSEng', order: 8, active: true },
    ];

    const defaultCategories = [
      { name: 'Regular Scholarship', code: 'REG', description: 'Standard city scholarship', order: 1, active: true },
      { name: 'Merit Scholarship', code: 'MERIT', description: 'For high academic achievers', order: 2, active: true },
      { name: 'Special Scholarship', code: 'SPEC', description: 'Special cases and grants', order: 3, active: true },
    ];

    const defaultStatuses = [
      { name: 'Pending', code: 'pending', color: '#f59e0b', order: 1, active: true },
      { name: 'Under Review', code: 'under_review', color: '#3b82f6', order: 2, active: true },
      { name: 'Approved', code: 'approved', color: '#10b981', order: 3, active: true },
      { name: 'Active Scholar', code: 'active_scholar', color: '#6366f1', order: 4, active: true },
      { name: 'On Hold / Probation', code: 'probation', color: '#f97316', order: 5, active: true },
      { name: 'Graduated', code: 'graduated', color: '#8b5cf6', order: 6, active: true },
      { name: 'Terminated', code: 'terminated', color: '#ef4444', order: 7, active: true },
      { name: 'Rejected', code: 'rejected', color: '#dc2626', order: 8, active: true },
    ];

    const defaultStages = [
      { name: 'Applicant', code: 'applicant', icon: 'file-text', color: '#3b82f6', order: 1, active: true },
      { name: 'Scholar', code: 'scholar', icon: 'user', color: '#10b981', order: 2, active: true },
      { name: 'Graduated', code: 'graduated', icon: 'graduation-cap', color: '#f59e0b', order: 3, active: true },
      { name: 'Board Passer', code: 'board_passer', icon: 'award', color: '#8b5cf6', order: 4, active: true },
      { name: 'Employed', code: 'employed', icon: 'briefcase', color: '#ec4899', order: 5, active: true },
    ];

    const seedCollection = (col, items) => {
      items.forEach((item, i) => {
        const ref = db.collection(col).doc(`default_${i + 1}`);
        batch.set(ref, { ...item, createdAt: now, seeded: true }, { merge: true });
      });
    };

    seedCollection(COLLECTIONS.SCHOOLS, defaultSchools);
    seedCollection(COLLECTIONS.PROGRAMS, defaultPrograms);
    seedCollection(COLLECTIONS.SCHOLARSHIP_CATEGORIES, defaultCategories);
    seedCollection(COLLECTIONS.SCHOLARSHIP_STATUSES, defaultStatuses);
    seedCollection(COLLECTIONS.TIMELINE_STAGES, defaultStages);

    batch.set(
      db.collection(COLLECTIONS.SYSTEM_CONFIG).doc('main'),
      {
        organizationName: 'Calapan City Education Department',
        contactEmail: 'ced@calapancity.gov.ph',
        scholarshipCap: 25000,
        sessionTimeoutMinutes: 60,
        enableAutoEvaluation: true,
        requireQrSignature: true,
        enablePushNotifications: true,
        allowApplicantResubmission: true,
        seededAt: now,
      },
      { merge: true }
    );

    await batch.commit();
    return res.json({ success: true, message: 'Default settings seeded' });
  } catch (err) {
    console.error('seedDefaultSettings error:', err);
    return handleError(res, err, 'systemSettings');
  }
});
