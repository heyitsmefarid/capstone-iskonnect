const DEFAULT_BASE_URL = 'http://127.0.0.1:5001/demo-capstone/us-central1';

function getBaseUrl() {
  return (import.meta.env.VITE_BACKEND_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

async function requestJson(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error
      ? payload.error
      : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

// ── Existing ───────────────────────────────────────────────────────────────

export async function fetchReportSummary() {
  return requestJson('/getReportSummary');
}

export async function fetchRequirements({ applicationId, userId } = {}) {
  const params = new URLSearchParams();
  if (applicationId) params.set('applicationId', applicationId);
  if (userId) params.set('userId', userId);
  return requestJson(`/listRequirements${params.toString() ? `?${params}` : ''}`);
}

export async function reviewRequirement({ applicationId, requirementId, status, reviewNotes }) {
  return requestJson('/reviewRequirement', {
    method: 'PATCH',
    body: { applicationId, requirementId, status, reviewNotes },
  });
}

export function getApplicationKey(applicant) {
  return applicant?.applicationId || applicant?.scholarId || String(applicant?.id || 'unknown');
}

// Renders the official BFCSP form via the shared `generateApplicationForm`
// Cloud Function (template overlay, logos included — the same generator the
// scholar app uses). Returns PDF bytes, or null if the call fails so the caller
// can fall back to the client-side generator.
export async function generateApplicationFormPdf(application) {
  try {
    const response = await fetch(`${getBaseUrl()}/generateApplicationForm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application }),
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

// ── System Settings ────────────────────────────────────────────────────────

export async function fetchSystemSettings() {
  return requestJson('/getSystemSettings');
}

export async function updateSystemConfig(config) {
  return requestJson('/updateSystemConfig', { method: 'POST', body: config });
}

export async function manageSettingsItem({ collection, action, id, data }) {
  return requestJson('/manageSettingsItem', {
    method: 'POST',
    body: { collection, action, id, data },
  });
}

export async function seedDefaultSettings() {
  return requestJson('/seedDefaultSettings', { method: 'POST' });
}

// ── School Years ───────────────────────────────────────────────────────────

export async function fetchSchoolYears() {
  return requestJson('/getSchoolYears');
}

export async function fetchActiveSchoolYear() {
  return requestJson('/getActiveSchoolYear');
}

export async function manageSchoolYear({ action, id, data }) {
  return requestJson('/manageSchoolYear', { method: 'POST', body: { action, id, data } });
}

export async function manageSemester({ action, schoolYearId, semesterId, data }) {
  return requestJson('/manageSemester', {
    method: 'POST',
    body: { action, schoolYearId, semesterId, data },
  });
}

// ── Evaluation ─────────────────────────────────────────────────────────────

export async function fetchRubric() {
  return requestJson('/getRubric');
}

export async function saveRubric(criteria) {
  return requestJson('/updateRubric', { method: 'POST', body: { criteria } });
}

export async function submitEvaluationScore({ applicationId, scores, notes, schoolYearId, semesterId }) {
  return requestJson('/submitEvaluationScore', {
    method: 'POST',
    body: { applicationId, scores, notes, schoolYearId, semesterId },
  });
}

export async function finalizeEvaluation({ applicationId }) {
  return requestJson('/finalizeEvaluation', { method: 'POST', body: { applicationId } });
}

export async function fetchEvaluationRankings({ schoolYearId } = {}) {
  const params = schoolYearId ? `?schoolYearId=${schoolYearId}` : '';
  return requestJson(`/getEvaluationRankings${params}`);
}

// ── Group Chat ─────────────────────────────────────────────────────────────

export async function manageGroupChat({ action, groupId, data }) {
  return requestJson('/manageGroupChat', { method: 'POST', body: { action, groupId, data } });
}

export async function sendGroupMessage({ groupId, message, attachmentUrl }) {
  return requestJson('/sendGroupMessage', { method: 'POST', body: { groupId, message, attachmentUrl } });
}

export async function fetchGroupMessages({ groupId, limit, before } = {}) {
  const params = new URLSearchParams({ groupId });
  if (limit) params.set('limit', limit);
  if (before) params.set('before', before);
  return requestJson(`/getGroupMessages?${params}`);
}

// ── User Management & Security ─────────────────────────────────────────────

export async function createManagedUser({ email, password, displayName, role, position }) {
  return requestJson('/createManagedUser', {
    method: 'POST',
    body: { email, password, displayName, role, position },
  });
}

export async function resetUserPassword({ targetUid, newPassword }) {
  return requestJson('/resetUserPassword', { method: 'POST', body: { targetUid, newPassword } });
}

export async function updateUserRole({ targetUid, newRole }) {
  return requestJson('/updateUserRole', { method: 'POST', body: { targetUid, newRole } });
}

export async function deactivateUser({ targetUid, disabled = true }) {
  return requestJson('/deactivateUser', { method: 'POST', body: { targetUid, disabled } });
}

// ── Audit Logs ─────────────────────────────────────────────────────────────

// Shared secret the backend's bulkCreateScholars endpoint checks (the admin
// panel is anonymous to Firebase, so it can't send an admin ID token). Override
// via VITE_ADMIN_IMPORT_KEY; defaults match the backend's dev fallback.
const ADMIN_IMPORT_KEY = import.meta.env.VITE_ADMIN_IMPORT_KEY || 'ced-admin-import-2026';

// Creates Firebase Auth accounts + active-scholar user docs for a chunk of
// rows. Returns { created, skipped, failed, total, results:[{email, password,
// scholarId, status, reason}] }.
export async function bulkCreateScholars(rows) {
  return requestJson('/bulkCreateScholars', {
    method: 'POST',
    headers: { 'x-admin-key': ADMIN_IMPORT_KEY },
    body: { rows },
  });
}

export async function fetchAuditLogs({ action, userId, collection, limit = 100 } = {}) {
  const params = new URLSearchParams({ limit });
  if (action) params.set('action', action);
  if (userId) params.set('userId', userId);
  if (collection) params.set('collection', collection);
  return requestJson(`/getAuditLogs?${params}`);
}
