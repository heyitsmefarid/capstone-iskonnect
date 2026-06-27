const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

function isAdmin(role) {
  return [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
}

// GET /getSchoolYears
exports.getSchoolYears = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });

    const { db } = getFirebaseAdmin();
    const snap = await db
      .collection(COLLECTIONS.SCHOOL_YEARS)
      .orderBy('startYear', 'desc')
      .get();

    const schoolYears = await Promise.all(
      snap.docs.map(async (doc) => {
        const semSnap = await db
          .collection(COLLECTIONS.SCHOOL_YEARS)
          .doc(doc.id)
          .collection('semesters')
          .orderBy('order', 'asc')
          .get();
        const semesters = semSnap.docs.map(s => ({ id: s.id, ...s.data() }));
        return { id: doc.id, ...doc.data(), semesters };
      })
    );

    return res.json({ schoolYears });
  } catch (err) {
    console.error('getSchoolYears error:', err);
    return handleError(res, err, 'schoolYears');
  }
});

// GET /getActiveSchoolYear
exports.getActiveSchoolYear = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });

    const { db } = getFirebaseAdmin();
    const sySnap = await db
      .collection(COLLECTIONS.SCHOOL_YEARS)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (sySnap.empty) return res.json({ schoolYear: null, semester: null });

    const syDoc = sySnap.docs[0];
    const schoolYear = { id: syDoc.id, ...syDoc.data() };

    const semSnap = await db
      .collection(COLLECTIONS.SCHOOL_YEARS)
      .doc(syDoc.id)
      .collection('semesters')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    const semester = semSnap.empty
      ? null
      : { id: semSnap.docs[0].id, ...semSnap.docs[0].data() };

    return res.json({ schoolYear, semester });
  } catch (err) {
    console.error('getActiveSchoolYear error:', err);
    return handleError(res, err, 'schoolYears');
  }
});

// POST /manageSchoolYear
exports.manageSchoolYear = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { db } = getFirebaseAdmin();
    const { action, id, data } = req.body || {};
    const now = new Date().toISOString();
    let docId = id;

    if (action === 'create') {
      const { startYear, endYear, label } = data || {};
      if (!startYear || !endYear) {
        return res.status(400).json({ error: 'startYear and endYear required' });
      }
      const ref = db.collection(COLLECTIONS.SCHOOL_YEARS).doc();
      docId = ref.id;
      await ref.set({
        startYear,
        endYear,
        label: label || `${startYear}-${endYear}`,
        isActive: false,
        createdAt: now,
        createdBy: ctx.user.uid,
      });
    } else if (action === 'update') {
      if (!docId) return res.status(400).json({ error: 'id required' });
      await db.collection(COLLECTIONS.SCHOOL_YEARS).doc(docId).update({
        ...data,
        updatedAt: now,
        updatedBy: ctx.user.uid,
      });
    } else if (action === 'delete') {
      if (!docId) return res.status(400).json({ error: 'id required' });
      const semSnap = await db
        .collection(COLLECTIONS.SCHOOL_YEARS)
        .doc(docId)
        .collection('semesters')
        .get();
      const batch = db.batch();
      semSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection(COLLECTIONS.SCHOOL_YEARS).doc(docId));
      await batch.commit();
    } else if (action === 'setActive') {
      if (!docId) return res.status(400).json({ error: 'id required' });
      const all = await db.collection(COLLECTIONS.SCHOOL_YEARS).get();
      const batch = db.batch();
      all.docs.forEach(d => batch.update(d.ref, { isActive: false }));
      batch.update(db.collection(COLLECTIONS.SCHOOL_YEARS).doc(docId), {
        isActive: true,
        activatedAt: now,
        activatedBy: ctx.user.uid,
      });
      await batch.commit();
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: action === 'setActive' ? 'STATUS_CHANGE' : action.toUpperCase(),
      collection: COLLECTIONS.SCHOOL_YEARS,
      documentId: docId,
      details: `School year ${action}`,
    });

    return res.json({ success: true, id: docId });
  } catch (err) {
    console.error('manageSchoolYear error:', err);
    return handleError(res, err, 'schoolYears');
  }
});

// POST /manageSemester
exports.manageSemester = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { db } = getFirebaseAdmin();
    const { action, schoolYearId, semesterId, data } = req.body || {};
    if (!schoolYearId) return res.status(400).json({ error: 'schoolYearId required' });

    const semRef = db
      .collection(COLLECTIONS.SCHOOL_YEARS)
      .doc(schoolYearId)
      .collection('semesters');

    const now = new Date().toISOString();
    let docId = semesterId;

    if (action === 'create') {
      const ref = semRef.doc();
      docId = ref.id;
      await ref.set({
        ...data,
        isActive: false,
        createdAt: now,
        createdBy: ctx.user.uid,
        order: data?.order || 1,
      });
    } else if (action === 'update') {
      if (!docId) return res.status(400).json({ error: 'semesterId required' });
      await semRef.doc(docId).update({ ...data, updatedAt: now, updatedBy: ctx.user.uid });
    } else if (action === 'delete') {
      if (!docId) return res.status(400).json({ error: 'semesterId required' });
      await semRef.doc(docId).delete();
    } else if (action === 'setActive') {
      if (!docId) return res.status(400).json({ error: 'semesterId required' });
      const allSem = await semRef.get();
      const batch = db.batch();
      allSem.docs.forEach(d => batch.update(d.ref, { isActive: false }));
      batch.update(semRef.doc(docId), {
        isActive: true,
        activatedAt: now,
        activatedBy: ctx.user.uid,
      });
      await batch.commit();
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: action === 'setActive' ? 'STATUS_CHANGE' : action.toUpperCase(),
      collection: 'semesters',
      documentId: docId,
      details: `Semester ${action} in school year ${schoolYearId}`,
    });

    return res.json({ success: true, id: docId });
  } catch (err) {
    console.error('manageSemester error:', err);
    return handleError(res, err, 'schoolYears');
  }
});
