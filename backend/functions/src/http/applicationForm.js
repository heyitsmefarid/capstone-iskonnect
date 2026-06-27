const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest } = require('../utils/requestAuth');
const { handleError } = require('../utils/errors');
const FirebaseEnvironmentValidator = require('../utils/firebaseEnvironmentValidator');
const { fillBfcspForm, toBfcspFields } = require('../utils/bfcspForm');

function canBypassAuth() {
  const env = FirebaseEnvironmentValidator.detectEnvironment();
  return env === FirebaseEnvironmentValidator.ENVIRONMENTS.DEVELOPMENT ||
    env === FirebaseEnvironmentValidator.ENVIRONMENTS.EMULATOR;
}

// Look up the full BFCSP record from Firestore by application doc id or userId.
async function lookupApplication({ applicationId, userId }) {
  const { db } = getFirebaseAdmin();
  const col = db.collection('scholarship_applications');
  if (applicationId) {
    const doc = await col.doc(applicationId).get();
    if (doc.exists) return { firestoreId: doc.id, ...doc.data() };
  }
  if (userId) {
    const snap = await col.where('userId', '==', userId).get();
    const records = snap.docs.map((d) => ({ firestoreId: d.id, ...d.data() }));
    if (records.length) {
      const rank = (r) => (r.status === 'submitted' ? 2 : r.status === 'under_review' ? 1 : 0);
      records.sort((a, b) => rank(b) - rank(a) ||
        String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
      return records[0];
    }
  }
  return null;
}

// Generates the official BFCSP application form as a PDF (template overlay).
// POST body accepts either:
//   { application: {...full record...} }  — render the supplied data directly, OR
//   { applicationId } / { userId }         — look the record up in Firestore.
const generateApplicationForm = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const needsLookup = !body.application && (body.applicationId || body.userId);

  // Rendering caller-supplied data needs no privileged access (they own the
  // data). A Firestore lookup does — require a signed-in session for that.
  const authContext = await authenticateRequest(req, {
    allowPublic: canBypassAuth() || !needsLookup,
  });
  if (!authContext.ok) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  try {
    let application = body.application;
    if (needsLookup) {
      application = await lookupApplication({
        applicationId: body.applicationId,
        userId: body.userId,
      });
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
    }
    if (!application || typeof application !== 'object') {
      return res.status(400).json({ error: 'Missing application data' });
    }

    const bytes = await fillBfcspForm(application);

    const f = toBfcspFields(application);
    const namePart = [f.lastName, f.firstName].filter(Boolean).join('_') || 'applicant';
    const fileName = `BFCSP_Application_${namePart}.pdf`.replace(/\s+/g, '_');

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${fileName}"`);
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    return handleError(res, error, 'generateApplicationForm');
  }
});

module.exports = { generateApplicationForm };
