const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

function isAdminOrStaff(role) {
  return [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.STAFF].includes(role);
}

// Official BFCSP rubric criteria
// Sources: Completion of Requirements (20%), Economic Background (30%)
// GWA/Academic (30%) and Interview/Other (20%) complete the 100
const DEFAULT_RUBRIC = [
  {
    id: 'requirements',
    label: 'Completion of Requirements',
    weight: 20,
    maxScore: 20,
    description: 'Completeness and organization of submitted documents',
    levels: [
      { label: 'Complete & Organized', points: 20, description: 'All requirements submitted on time; complete, accurate, and properly organized' },
      { label: 'Complete but Slightly Lacking', points: 15, description: 'All requirements submitted but with minor errors or formatting issues' },
      { label: 'Incomplete (Minor)', points: 10, description: 'Missing 1–2 minor requirements or with noticeable inconsistencies' },
      { label: 'Incomplete (Major)', points: 5, description: 'Several missing or incorrect documents' },
      { label: 'Non-compliant', points: 0, description: 'Failed to submit majority of required documents' },
    ],
  },
  {
    id: 'economic',
    label: 'Economic Background',
    weight: 30,
    maxScore: 30,
    description: 'Financial need based on cedula amount and average electric bills',
    levels: [
      { label: 'Highly Disadvantaged', points: 30, cedulaRange: '₱5–₱150', electricBillRange: '₱500 and below', description: 'Very low declared income; minimal electricity use; 4+ dependents; irregular/no stable income' },
      { label: 'Disadvantaged', points: 25, cedulaRange: '₱151–₱500', electricBillRange: '₱501–₱1,000', description: 'Low declared income; low consumption; 3–4 dependents; limited financial capacity' },
      { label: 'Moderately Disadvantaged', points: 20, cedulaRange: '₱501–₱1,000', electricBillRange: '₱1,001–₱2,000', description: 'Modest declared income; average consumption; 1–2 dependents' },
      { label: 'Slightly Disadvantaged', points: 15, cedulaRange: '₱1,001–₱2,000', electricBillRange: '₱2,001–₱3,500', description: 'Stable income; above-average consumption; 1–2 dependents' },
      { label: 'Financially Capable', points: 10, cedulaRange: 'Above ₱2,000', electricBillRange: 'Above ₱3,500', description: 'Higher declared income; high consumption; few or no dependents' },
    ],
  },
  {
    id: 'academic',
    label: 'Academic Performance (GWA)',
    weight: 30,
    maxScore: 30,
    description: 'Based on Senior High School General Weighted Average',
    levels: [
      { label: 'Outstanding (90–100 / 1.00–1.25)', points: 30, description: 'GWA of 90 and above or equivalent' },
      { label: 'Very Satisfactory (85–89 / 1.26–1.50)', points: 25, description: 'GWA of 85–89 or equivalent' },
      { label: 'Satisfactory (80–84 / 1.51–1.75)', points: 20, description: 'GWA of 80–84 or equivalent' },
      { label: 'Fairly Satisfactory (75–79 / 1.76–2.00)', points: 15, description: 'GWA of 75–79 or equivalent' },
      { label: 'Did Not Meet Expectations (Below 75)', points: 10, description: 'GWA below 75 or equivalent' },
    ],
  },
  {
    id: 'interview',
    label: 'Interview / Personal Assessment',
    weight: 20,
    maxScore: 20,
    description: 'Performance during the scholarship interview',
    levels: [
      { label: 'Exceptional', points: 20, description: 'Outstanding communication; clear motivation; strong commitment to community' },
      { label: 'Proficient', points: 15, description: 'Good communication; clear goals; demonstrates community awareness' },
      { label: 'Developing', points: 10, description: 'Average communication; some clarity in goals' },
      { label: 'Beginning', points: 5, description: 'Limited communication; vague goals' },
      { label: 'Not Interviewed', points: 0, description: 'Did not appear for interview' },
    ],
  },
];

// GET /getRubric
exports.getRubric = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });

    const { db } = getFirebaseAdmin();
    const snap = await db.collection(COLLECTIONS.EVALUATION_RUBRICS).doc('applicant').get();
    const rubric = snap.exists ? snap.data().criteria : DEFAULT_RUBRIC;

    return res.json({ rubric });
  } catch (err) {
    return handleError(res, err, 'getRubric');
  }
});

// POST /updateRubric
exports.updateRubric = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { criteria } = req.body || {};
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({ error: 'criteria array required' });
    }

    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      return res.status(400).json({ error: `Weights must sum to 100 (currently ${totalWeight})` });
    }

    const { db } = getFirebaseAdmin();
    await db.collection(COLLECTIONS.EVALUATION_RUBRICS).doc('applicant').set({
      criteria,
      updatedAt: new Date().toISOString(),
      updatedBy: ctx.user.uid,
    });

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: 'UPDATE',
      collection: COLLECTIONS.EVALUATION_RUBRICS,
      documentId: 'applicant',
      details: 'Evaluation rubric updated',
    });

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'updateRubric');
  }
});

// POST /submitEvaluationScore — staff encodes; admin can edit any
exports.submitEvaluationScore = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { applicationId, scores, notes, schoolYearId, semesterId } = req.body || {};
    if (!applicationId || !scores) {
      return res.status(400).json({ error: 'applicationId and scores required' });
    }

    const { db } = getFirebaseAdmin();

    const appDoc = await db.collection(COLLECTIONS.APPLICATIONS).doc(applicationId).get();
    if (!appDoc.exists) return res.status(404).json({ error: 'Application not found' });

    const rubricDoc = await db.collection(COLLECTIONS.EVALUATION_RUBRICS).doc('applicant').get();
    const criteria = rubricDoc.exists ? rubricDoc.data().criteria : DEFAULT_RUBRIC;

    // Compute total: each criterion score is taken directly (already in its point scale)
    let totalScore = 0;
    const scoreBreakdown = criteria.map(criterion => {
      const raw = Number(scores[criterion.id] || 0);
      const clamped = Math.min(Math.max(raw, 0), criterion.maxScore);
      totalScore += clamped;
      return {
        id: criterion.id,
        label: criterion.label,
        score: clamped,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
      };
    });

    const now = new Date().toISOString();
    const scoreRef = db.collection(COLLECTIONS.EVALUATION_SCORES).doc(applicationId);
    const existing = await scoreRef.get();

    // Staff cannot edit a finalized evaluation
    if (existing.exists && existing.data().finalized && ctx.role === ROLES.STAFF) {
      return res.status(403).json({ error: 'Cannot edit a finalized evaluation' });
    }

    await scoreRef.set({
      applicationId,
      applicantId: appDoc.data().userId,
      scores,
      scoreBreakdown,
      totalScore: Math.round(totalScore * 100) / 100,
      notes: notes || '',
      schoolYearId: schoolYearId || null,
      semesterId: semesterId || null,
      encodedBy: ctx.user.uid,
      encodedByEmail: ctx.user.email,
      encodedByRole: ctx.role,
      encodedAt: now,
      finalized: existing.exists ? existing.data().finalized : false,
      updatedAt: now,
    }, { merge: true });

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: existing.exists ? 'UPDATE' : 'CREATE',
      collection: COLLECTIONS.EVALUATION_SCORES,
      documentId: applicationId,
      details: `Evaluation ${existing.exists ? 'updated' : 'created'} — total: ${totalScore.toFixed(2)}/100`,
    });

    return res.json({ success: true, totalScore, scoreBreakdown });
  } catch (err) {
    return handleError(res, err, 'submitEvaluationScore');
  }
});

// POST /finalizeEvaluation — admin locks an evaluation from further staff edits
exports.finalizeEvaluation = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { applicationId } = req.body || {};
    if (!applicationId) return res.status(400).json({ error: 'applicationId required' });

    const { db } = getFirebaseAdmin();
    const scoreRef = db.collection(COLLECTIONS.EVALUATION_SCORES).doc(applicationId);
    const snap = await scoreRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Evaluation not found' });

    await scoreRef.update({
      finalized: true,
      finalizedBy: ctx.user.uid,
      finalizedAt: new Date().toISOString(),
    });

    await writeAuditLog(db, {
      userId: ctx.user.uid,
      userEmail: ctx.user.email,
      userRole: ctx.role,
      action: 'UPDATE',
      collection: COLLECTIONS.EVALUATION_SCORES,
      documentId: applicationId,
      details: 'Evaluation finalized by admin',
    });

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'finalizeEvaluation');
  }
});

// GET /getEvaluationRankings
exports.getEvaluationRankings = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });

    const { db } = getFirebaseAdmin();
    const { schoolYearId } = req.query || {};

    let query = db.collection(COLLECTIONS.EVALUATION_SCORES).orderBy('totalScore', 'desc');
    if (schoolYearId) query = query.where('schoolYearId', '==', schoolYearId);

    const snap = await query.get();
    const rankings = snap.docs.map((d, i) => ({
      rank: i + 1,
      id: d.id,
      ...d.data(),
    }));

    return res.json({ rankings });
  } catch (err) {
    return handleError(res, err, 'getEvaluationRankings');
  }
});

// Export default rubric for use in seeding
exports.DEFAULT_RUBRIC = DEFAULT_RUBRIC;
