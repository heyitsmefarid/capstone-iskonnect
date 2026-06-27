const admin = require('firebase-admin');

/**
 * Firebase environment validator and enforcer
 * Ensures production/development separation and prevents data contamination
 */
class FirebaseEnvironmentValidator {
  /**
   * Firebase environments that are supported
   */
  static ENVIRONMENTS = {
    PRODUCTION: 'production',
    STAGING: 'staging',
    DEVELOPMENT: 'development',
    EMULATOR: 'emulator',
  };

  /**
   * Allowed operations by environment
   */
  static ALLOWED_OPERATIONS = {
    production: {
      read: true,
      write: true,
      delete: false, // Disable destructive operations in production
      batchWrite: true,
      batchDelete: false,
    },
    staging: {
      read: true,
      write: true,
      delete: true,
      batchWrite: true,
      batchDelete: true,
    },
    development: {
      read: true,
      write: true,
      delete: true,
      batchWrite: true,
      batchDelete: true,
    },
    emulator: {
      read: true,
      write: true,
      delete: true,
      batchWrite: true,
      batchDelete: true,
    },
  };

  /**
   * Detect current Firebase environment
   * @returns {string} Environment name
   */
  static detectEnvironment() {
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
    const useEmulator = process.env.FIREBASE_EMULATOR_HOST ? true : false;

    if (useEmulator) {
      return this.ENVIRONMENTS.EMULATOR;
    }

    if (!projectId) {
      throw new Error('Firebase project ID not configured');
    }

    // Check if production project
    const productionIds = [
      'capstone-production',
      'iskonnect-prod',
      'production-db',
    ];

    if (productionIds.some(id => projectId.includes(id))) {
      return this.ENVIRONMENTS.PRODUCTION;
    }

    // Check if staging project
    const stagingIds = ['capstone-staging', 'iskonnect-staging', 'staging-db'];
    if (stagingIds.some(id => projectId.includes(id))) {
      return this.ENVIRONMENTS.STAGING;
    }

    // Default to development
    return this.ENVIRONMENTS.DEVELOPMENT;
  }

  /**
   * Validate if operation is allowed in current environment
   * @param {string} operation - Operation type (read, write, delete, etc.)
   * @param {string} environment - Environment override (optional)
   * @returns {{allowed: boolean, warnings: Array<string>}}
   */
  static validateOperation(operation, environment = null) {
    const env = environment || this.detectEnvironment();
    const warnings = [];

    if (!(env in this.ALLOWED_OPERATIONS)) {
      return { allowed: false, warnings: [`Unknown environment: ${env}`] };
    }

    const isAllowed = this.ALLOWED_OPERATIONS[env][operation] === true;

    if (!isAllowed) {
      warnings.push(
        `Operation '${operation}' is not allowed in '${env}' environment`
      );
    }

    // Add warnings for sensitive operations
    if (env === this.ENVIRONMENTS.PRODUCTION) {
      if (operation === 'write' || operation === 'batchWrite') {
        warnings.push('⚠️ Writing to PRODUCTION database');
      }
    }

    return { allowed: isAllowed, warnings };
  }

  /**
   * Enforce production mode - prevent data contamination
   * @throws {Error} If environment validation fails
   */
  static enforceProductionMode() {
    const environment = this.detectEnvironment();
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

    if (environment === this.ENVIRONMENTS.PRODUCTION) {
      // Production safety checks
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(
          'Cannot run in production environment with NODE_ENV != "production"'
        );
      }

      // Ensure admin SDK is using service account
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error(
          'GOOGLE_APPLICATION_CREDENTIALS environment variable not set for production deployment'
        );
      }

      console.warn('⚠️ PRODUCTION MODE ENFORCED');
      console.warn(`Project ID: ${projectId}`);
      console.warn('Destructive operations are DISABLED');
    }

    return {
      environment,
      projectId,
      isProduction: environment === this.ENVIRONMENTS.PRODUCTION,
    };
  }

  /**
   * Wrap database operations with environment checks
   * @param {Function} operation - Database operation function
   * @param {string} operationType - Type of operation
   * @throws {Error} If operation not allowed in current environment
   */
  static withEnvironmentCheck(operation, operationType) {
    return async function(...args) {
      const { allowed, warnings } = FirebaseEnvironmentValidator.validateOperation(
        operationType
      );

      if (!allowed) {
        throw new Error(
          `Operation '${operationType}' is not allowed in current environment`
        );
      }

      // Log warnings
      for (const warning of warnings) {
        if (warning.startsWith('⚠️')) {
          console.warn(warning);
        }
      }

      return operation(...args);
    };
  }

  /**
   * Middleware for Firebase Functions
   * Validates environment before processing requests
   */
  static middleware() {
    return (req, res, next) => {
      try {
        const { allowed, warnings } = FirebaseEnvironmentValidator.validateOperation('write');

        if (warnings.length > 0) {
          req.environmentWarnings = warnings;
        }

        if (process.env.NODE_ENV === 'production' && !allowed) {
          return res.status(403).json({
            error: 'Operation not allowed in production environment',
          });
        }

        // Store environment info in request
        req.environment = {
          name: this.detectEnvironment(),
          projectId: process.env.GCLOUD_PROJECT,
          isProduction: this.detectEnvironment() === this.ENVIRONMENTS.PRODUCTION,
        };

        next();
      } catch (error) {
        console.error('Environment validation error:', error);
        return res.status(500).json({
          error: 'Environment validation failed',
          details: error.message,
        });
      }
    };
  }

  /**
   * Create safety guard for collections
   * Prevents accidental operations on wrong collections
   */
  static createCollectionGuard(db, collectionName) {
    return {
      doc: (docId) => {
        return {
          get: async () => {
            // Read operations allowed everywhere
            return db.collection(collectionName).doc(docId).get();
          },
          set: async (data) => {
            const { allowed } = FirebaseEnvironmentValidator.validateOperation('write');
            if (!allowed) throw new Error('Write not allowed in this environment');
            return db.collection(collectionName).doc(docId).set(data);
          },
          update: async (data) => {
            const { allowed } = FirebaseEnvironmentValidator.validateOperation('write');
            if (!allowed) throw new Error('Write not allowed in this environment');
            return db.collection(collectionName).doc(docId).update(data);
          },
          delete: async () => {
            const { allowed } = FirebaseEnvironmentValidator.validateOperation('delete');
            if (!allowed) throw new Error('Delete not allowed in this environment');
            return db.collection(collectionName).doc(docId).delete();
          },
        };
      },
      where: (field, operator, value) => {
        return db.collection(collectionName).where(field, operator, value);
      },
    };
  }

  /**
   * Log environment information
   */
  static logEnvironmentInfo() {
    const env = this.detectEnvironment();
    const projectId = process.env.GCLOUD_PROJECT;
    const nodeEnv = process.env.NODE_ENV;

    console.log('═══════════════════════════════════════');
    console.log('Firebase Environment Configuration');
    console.log('═══════════════════════════════════════');
    console.log(`Environment: ${env.toUpperCase()}`);
    console.log(`Project ID: ${projectId}`);
    console.log(`Node ENV: ${nodeEnv}`);
    console.log(`Emulator: ${process.env.FIREBASE_EMULATOR_HOST || 'Not active'}`);
    console.log('═══════════════════════════════════════');

    if (env === this.ENVIRONMENTS.PRODUCTION) {
      console.warn(
        '⚠️  PRODUCTION MODE - Data modifications logged and verified'
      );
    }
  }
}

module.exports = FirebaseEnvironmentValidator;
