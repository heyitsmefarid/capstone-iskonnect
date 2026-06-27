const { getFirebaseAdmin } = require('../config/firebase');

/**
 * Abstract base repository for Firestore collections
 * Provides common CRUD operations and query utilities
 */
class BaseRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
    const { db, fieldValue } = getFirebaseAdmin();
    this.db = db;
    this.fieldValue = fieldValue;
  }

  /**
   * Create a new document
   * @param {string} docId - Document ID
   * @param {object} data - Document data
   * @returns {Promise<void>}
   */
  async create(docId, data) {
    const timestamp = this.fieldValue.serverTimestamp();
    const docData = {
      ...data,
      isArchived: data.isArchived ?? false,
      archivedAt: data.archivedAt ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db.collection(this.collectionName).doc(docId).set(docData);
  }

  /**
   * Read a document by ID
   * @param {string} docId - Document ID
   * @returns {Promise<object|null>}
   */
  async read(docId) {
    const snapshot = await this.db.collection(this.collectionName).doc(docId).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
  }

  /**
   * Update a document
   * @param {string} docId - Document ID
   * @param {object} data - Fields to update
   * @returns {Promise<void>}
   */
  async update(docId, data) {
    const updateData = {
      ...data,
      updatedAt: this.fieldValue.serverTimestamp(),
    };
    await this.db.collection(this.collectionName).doc(docId).update(updateData);
  }

  /**
   * Delete a document
   * @param {string} docId - Document ID
   * @returns {Promise<void>}
   */
  async delete(docId) {
    await this.db.collection(this.collectionName).doc(docId).delete();
  }

  /**
   * Query documents with filters
   * @param {Array<Array>} filters - Array of [field, operator, value]
   * @param {object} options - Query options (limit, orderBy, etc.)
   * @returns {Promise<Array<object>>}
   */
  async query(filters = [], options = {}) {
    let query = this.db.collection(this.collectionName);

    // Apply filters
    for (const [field, operator, value] of filters) {
      query = query.where(field, operator, value);
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Batch write multiple documents
   * @param {Array<{docId: string, data: object, operation: 'set'|'update'|'delete'}>} writes
   * @returns {Promise<void>}
   */
  async batchWrite(writes) {
    const batch = this.db.batch();

    for (const write of writes) {
      const docRef = this.db.collection(this.collectionName).doc(write.docId);

      if (write.operation === 'set') {
        const data = {
          ...write.data,
          isArchived: write.data?.isArchived ?? false,
          archivedAt: write.data?.archivedAt ?? null,
          createdAt: this.fieldValue.serverTimestamp(),
          updatedAt: this.fieldValue.serverTimestamp(),
        };
        batch.set(docRef, data);
      } else if (write.operation === 'update') {
        const data = {
          ...write.data,
          updatedAt: this.fieldValue.serverTimestamp(),
        };
        batch.update(docRef, data);
      } else if (write.operation === 'delete') {
        batch.delete(docRef);
      }
    }

    await batch.commit();
  }

  /**
   * Count documents matching filters
   * @param {Array<Array>} filters - Array of [field, operator, value]
   * @returns {Promise<number>}
   */
  async count(filters = []) {
    let query = this.db.collection(this.collectionName);

    for (const [field, operator, value] of filters) {
      query = query.where(field, operator, value);
    }

    const snapshot = await query.count().get();
    return snapshot.data().count;
  }

  /**
   * Check if document exists
   * @param {string} docId - Document ID
   * @returns {Promise<boolean>}
   */
  async exists(docId) {
    const snapshot = await this.db.collection(this.collectionName).doc(docId).get();
    return snapshot.exists;
  }

  /**
   * Set merge on document (create or update)
   * @param {string} docId - Document ID
   * @param {object} data - Document data
   * @returns {Promise<void>}
   */
  async merge(docId, data) {
    const mergeData = {
      ...data,
      updatedAt: this.fieldValue.serverTimestamp(),
    };
    await this.db.collection(this.collectionName).doc(docId).set(mergeData, { merge: true });
  }

  /**
   * Archive a document without deleting it
   * @param {string} docId - Document ID
   * @param {object} metadata - Optional archive metadata
   * @returns {Promise<void>}
   */
  async archive(docId, metadata = {}) {
    await this.update(docId, {
      isArchived: true,
      archivedAt: this.fieldValue.serverTimestamp(),
      ...metadata,
    });
  }

  /**
   * Restore an archived document
   * @param {string} docId - Document ID
   * @returns {Promise<void>}
   */
  async restore(docId) {
    await this.update(docId, {
      isArchived: false,
      archivedAt: null,
    });
  }
}

module.exports = BaseRepository;
