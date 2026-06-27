const { ROLES } = require('../constants/collections');

function normalizeRole(role) {
  if (!role) {
    return null;
  }

  const normalized = String(role).toLowerCase();
  return Object.values(ROLES).includes(normalized) ? normalized : null;
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return normalized === ROLES.ADMIN || normalized === ROLES.SUPER_ADMIN;
}

function isScholarRole(role) {
  return normalizeRole(role) === ROLES.SCHOLAR;
}

function isApplicantRole(role) {
  return normalizeRole(role) === ROLES.APPLICANT;
}

module.exports = {
  normalizeRole,
  isAdminRole,
  isScholarRole,
  isApplicantRole,
};
