const crypto = require('crypto');

/**
 * QR Payload format and validation
 * Ensures data integrity and authenticity of QR codes
 */
class QRPayload {
  /**
   * QR payload structure:
   * {
   *   "schemaVersion": "1.0",
   *   "eventId": "event_xxx",
   *   "scholarId": "scholar_xxx",
   *   "timestamp": "2024-01-15T10:30:00Z",
   *   "signature": "hex_encoded_signature",
   *   "data": {
   *     "type": "attendance",
   *     "metadata": {...}
   *   }
   * }
   */

  static SCHEMA_VERSION = '1.0';
  static SIGNATURE_ALGORITHM = 'sha256';
  static PAYLOAD_ENCODING = 'utf8';
  static SIGNATURE_ENCODING = 'hex';

  /**
   * Validate QR payload structure
   * @param {object} payload - QR payload data
   * @returns {{valid: boolean, errors: Array<string>}}
   */
  static validateStructure(payload) {
    const errors = [];

    if (!payload) {
      errors.push('Payload is empty');
      return { valid: false, errors };
    }

    // Required fields
    const requiredFields = ['schemaVersion', 'eventId', 'scholarId', 'timestamp', 'signature', 'data'];
    for (const field of requiredFields) {
      if (!(field in payload)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Schema version check
    if (payload.schemaVersion && payload.schemaVersion !== this.SCHEMA_VERSION) {
      errors.push(`Invalid schema version: ${payload.schemaVersion}, expected: ${this.SCHEMA_VERSION}`);
    }

    // Event ID format (should be non-empty string)
    if (payload.eventId && typeof payload.eventId !== 'string') {
      errors.push('eventId must be a string');
    }

    // Scholar ID format (should be non-empty string)
    if (payload.scholarId && typeof payload.scholarId !== 'string') {
      errors.push('scholarId must be a string');
    }

    // Timestamp format (ISO 8601)
    if (payload.timestamp) {
      const timestamp = new Date(payload.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push(`Invalid timestamp format: ${payload.timestamp}`);
      }
    }

    // Signature format (should be hex string)
    if (payload.signature && !/^[a-f0-9]+$/i.test(payload.signature)) {
      errors.push('Signature must be a valid hex string');
    }

    // Data object
    if (payload.data && typeof payload.data !== 'object') {
      errors.push('data must be an object');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate timestamp is recent (within acceptable window)
   * @param {string} timestampStr - ISO timestamp string
   * @param {number} maxAgeSec - Maximum age in seconds (default: 300)
   * @returns {{valid: boolean, message: string}}
   */
  static validateTimestamp(timestampStr, maxAgeSec = 300) {
    try {
      const timestamp = new Date(timestampStr).getTime();
      const now = new Date().getTime();
      const ageMs = now - timestamp;
      const ageSec = ageMs / 1000;

      if (ageSec < -60) { // Allow 60 sec clock skew in future
        return { valid: false, message: `Timestamp is in the future by ${-ageSec}s` };
      }

      if (ageSec > maxAgeSec) {
        return { valid: false, message: `Timestamp is too old: ${ageSec}s (max: ${maxAgeSec}s)` };
      }

      return { valid: true, message: 'Timestamp is valid' };
    } catch (error) {
      return { valid: false, message: `Invalid timestamp: ${error.message}` };
    }
  }

  /**
   * Generate signature for payload
   * @param {object} payload - Payload object (without signature field)
   * @param {string} secret - Signing secret/key
   * @returns {string} - Hex encoded signature
   */
  static generateSignature(payload, secret) {
    // Create payload without signature field
    const { signature, ...payloadToSign } = payload;

    // Stringify in deterministic order
    const payloadStr = JSON.stringify(payloadToSign, Object.keys(payloadToSign).sort());

    // Generate HMAC signature
    const hmac = crypto.createHmac(this.SIGNATURE_ALGORITHM, secret);
    hmac.update(payloadStr, this.PAYLOAD_ENCODING);
    return hmac.digest(this.SIGNATURE_ENCODING);
  }

  /**
   * Verify payload signature
   * @param {object} payload - Complete payload with signature
   * @param {string} secret - Signing secret/key
   * @returns {{valid: boolean, message: string}}
   */
  static verifySignature(payload, secret) {
    try {
      const providedSignature = payload.signature;
      const calculatedSignature = this.generateSignature(payload, secret);

      // Use timing-safe comparison to prevent timing attacks
      const match = crypto.timingSafeEqual(
        Buffer.from(providedSignature, this.SIGNATURE_ENCODING),
        Buffer.from(calculatedSignature, this.SIGNATURE_ENCODING)
      );

      if (!match) {
        return { valid: false, message: 'Signature verification failed' };
      }

      return { valid: true, message: 'Signature is valid' };
    } catch (error) {
      return { valid: false, message: `Signature verification error: ${error.message}` };
    }
  }

  /**
   * Complete payload validation
   * @param {object} payload - QR payload
   * @param {string} secret - Signing secret
   * @param {object} options - Validation options
   * @returns {Promise<{valid: boolean, errors: Array<string>, warnings: Array<string>}>}
   */
  static async validate(payload, secret, options = {}) {
    const errors = [];
    const warnings = [];

    // 1. Validate structure
    const structureCheck = this.validateStructure(payload);
    if (!structureCheck.valid) {
      errors.push(...structureCheck.errors);
      return { valid: false, errors, warnings };
    }

    // 2. Validate timestamp
    const maxAge = options.maxTimestampAgeSec || 300;
    const timestampCheck = this.validateTimestamp(payload.timestamp, maxAge);
    if (!timestampCheck.valid) {
      errors.push(timestampCheck.message);
    }

    // 3. Verify signature
    const signatureCheck = this.verifySignature(payload, secret);
    if (!signatureCheck.valid) {
      errors.push(signatureCheck.message);
    }

    // 4. Additional data validation if provided
    if (options.customValidators && Array.isArray(options.customValidators)) {
      for (const validator of options.customValidators) {
        const result = await validator(payload);
        if (!result.valid) {
          errors.push(...(result.errors || []));
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

module.exports = QRPayload;
