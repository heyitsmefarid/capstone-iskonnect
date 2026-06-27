/* eslint-disable no-console */
const BASE_URL = process.env.FUNCTIONS_BASE_URL || 'http://127.0.0.1:5001/demo-capstone/us-central1';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${path}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function main() {
  console.log(`Running smoke checks against ${BASE_URL}`);

  const summary = await request('/getReportSummary');
  if (!summary?.ok || !summary?.summary) {
    throw new Error('Invalid getReportSummary response');
  }
  console.log('OK getReportSummary:', summary.summary);

  const before = await request('/listRequirements?applicationId=APP-2026-0001&userId=applicant-student-001');
  if (!before?.ok || !Array.isArray(before.requirements)) {
    throw new Error('Invalid listRequirements response before review');
  }
  console.log('OK listRequirements before review:', before.requirements.length);

  const target = before.requirements.find((item) => item.id === 'birth_certificate') || before.requirements[0];
  if (!target?.id) {
    throw new Error('No requirement found to review');
  }

  const reviewed = await request('/reviewRequirement', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationId: 'APP-2026-0001',
      requirementId: target.id,
      status: 'approved',
      reviewNotes: 'Smoke check approval',
    }),
  });

  if (!reviewed?.ok || reviewed.status !== 'approved') {
    throw new Error('Invalid reviewRequirement response');
  }
  console.log('OK reviewRequirement:', reviewed.requirementId, reviewed.status);

  const after = await request('/listRequirements?applicationId=APP-2026-0001&userId=applicant-student-001');
  const updated = after.requirements.find((item) => item.id === target.id);
  if (!updated || updated.status !== 'approved') {
    throw new Error('Requirement status did not update after review');
  }
  console.log('OK listRequirements after review:', updated.id, updated.status);

  console.log('Smoke checks passed.');
}

main().catch((error) => {
  console.error('Smoke checks failed:', error.message);
  process.exit(1);
});
