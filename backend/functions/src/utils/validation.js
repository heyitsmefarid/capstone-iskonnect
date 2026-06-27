'use strict';

/**
 * Shared validation and sanitization utilities used across all HTTP endpoints.
 */

// Characters that are dangerous in stored text / reflected output
const DANGEROUS_CHARS_RE = /[<>"'`;]/g;

/**
 * Strip dangerous characters from a string value.
 * Does NOT strip from passwords or hashed content.
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(DANGEROUS_CHARS_RE, '');
}

/**
 * Recursively sanitize all string values in an object.
 * Safe to call on req.body before processing.
 *
 * @param {*}      obj
 * @param {number} [maxDepth=4]
 * @returns {*}
 */
function sanitizeObject(obj, maxDepth = 4, _depth = 0) {
  if (_depth > maxDepth || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((v) => sanitizeObject(v, maxDepth, _depth + 1));
  }
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Trim only — deeper sanitization is caller responsibility
      out[key] = value.trim();
    } else if (typeof value === 'object') {
      out[key] = sanitizeObject(value, maxDepth, _depth + 1);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// RFC 5322 simplified — rejects most obviously invalid addresses
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Return true if `email` is a structurally valid email address.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length <= 254 && EMAIL_RE.test(trimmed);
}

/**
 * Return true if `uid` looks like a Firebase UID (20-128 alphanumeric chars).
 */
function isValidUid(uid) {
  if (!uid || typeof uid !== 'string') return false;
  return /^[a-zA-Z0-9_\-]{20,128}$/.test(uid);
}

/**
 * Return an array of field names that are missing (null / undefined / empty string)
 * from `body`. Returns [] if all fields are present.
 */
function validateRequiredFields(body, fields) {
  return fields.filter((f) => {
    const val = body[f];
    return val === undefined || val === null || val === '';
  });
}

/**
 * Return an error message if `value` is not in `allowed`, otherwise null.
 */
function validateEnum(value, allowed, fieldName = 'value') {
  if (!allowed.includes(value)) {
    return `${fieldName} must be one of: ${allowed.join(', ')}`;
  }
  return null;
}

/**
 * Return an error message if `value` is not a string within [min, max] chars, otherwise null.
 */
function validateStringLength(value, fieldName, min = 1, max = 500) {
  if (typeof value !== 'string') return `${fieldName} must be a string.`;
  const len = value.trim().length;
  if (len < min) return `${fieldName} must be at least ${min} character${min !== 1 ? 's' : ''}.`;
  if (len > max) return `${fieldName} must not exceed ${max} characters.`;
  return null;
}

/**
 * Return an error message if `value` is not a positive integer, otherwise null.
 */
function validatePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return `${fieldName} must be a positive integer.`;
  return null;
}

/**
 * Collect all validation errors and return them.
 * Returns null if there are no errors.
 *
 * Usage:
 *   const errors = collectErrors([
 *     validateEnum(role, ALLOWED_ROLES, 'role'),
 *     validateStringLength(displayName, 'displayName', 1, 120),
 *   ]);
 *   if (errors) return res.status(400).json({ error: 'Validation failed', details: errors });
 */
function collectErrors(results) {
  const errors = results.filter(Boolean);
  return errors.length ? errors : null;
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  isValidEmail,
  isValidUid,
  validateRequiredFields,
  validateEnum,
  validateStringLength,
  validatePositiveInt,
  collectErrors,
};
