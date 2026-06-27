function buildRequirementStoragePath({ applicationId, userId, requirementType, fileName }) {
  const safeRequirementType = String(requirementType || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = String(fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `requirements/${userId}/${applicationId}/${safeRequirementType}/${Date.now()}_${safeFileName}`;
}

function buildScholarDocumentPath({ scholarId, documentType, fileName }) {
  const safeDocumentType = String(documentType || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = String(fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `scholars/${scholarId}/${safeDocumentType}/${Date.now()}_${safeFileName}`;
}

module.exports = {
  buildRequirementStoragePath,
  buildScholarDocumentPath,
};
