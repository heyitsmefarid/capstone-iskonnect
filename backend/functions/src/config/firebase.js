const admin = require('firebase-admin');

function safeServerTimestamp() {
  const serverTimestamp = admin.firestore?.FieldValue?.serverTimestamp;
  if (typeof serverTimestamp === 'function') {
    return serverTimestamp();
  }

  return new Date().toISOString();
}

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp();
    } catch (_) {
      admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-capstone',
      });
    }
  }

  let db;
  let auth;
  let storage;

  try {
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
  } catch (_) {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-capstone',
      });
    }

    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
  }

  return {
    admin,
    db,
    auth,
    storage,
    fieldValue: {
      serverTimestamp: safeServerTimestamp,
    },
    timestamp: admin.firestore.Timestamp,
  };
}

module.exports = {
  getFirebaseAdmin,
};
