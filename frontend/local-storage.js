// Local Storage Manager - IndexedDB for Persistent Evidence Vault
class LocalStorageManager {
  constructor() {
    this.dbName = 'nexus_evidence_vault';
    this.dbVersion = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (e) => {
        console.error('IndexedDB error:', e);
        reject('Failed to open database');
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Investigations Store
        if (!db.objectStoreNames.contains('investigations')) {
          const invStore = db.createObjectStore('investigations', { keyPath: 'id' });
          invStore.createIndex('timestamp', 'timestamp', { unique: false });
          invStore.createIndex('type', 'type', { unique: false });
        }

        // Analysis Records Store
        if (!db.objectStoreNames.contains('analyses')) {
          const analysisStore = db.createObjectStore('analyses', { keyPath: 'id', autoIncrement: true });
          analysisStore.createIndex('investigationId', 'investigationId', { unique: false });
          analysisStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  // Save investigation
  async saveInvestigation(data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['investigations'], 'readwrite');
      const store = tx.objectStore('investigations');

      const record = {
        id: data.id || 'NX-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        timestamp: new Date().toISOString(),
        title: data.title || 'Untitled Investigation',
        type: data.type || 'multimodal',
        status: data.status || 'complete',
        results: data.results || {},
        metrics: data.metrics || {}
      };

      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = (e) => reject(e);
    });
  }

  // Get all investigations
  async getAllInvestigations() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['investigations'], 'readonly');
      const store = tx.objectStore('investigations');
      const request = store.getAll();

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e);
    });
  }

  // Get investigation by ID
  async getInvestigation(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['investigations'], 'readonly');
      const store = tx.objectStore('investigations');
      const request = store.get(id);

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e);
    });
  }

  // Delete investigation
  async deleteInvestigation(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['investigations'], 'readwrite');
      const store = tx.objectStore('investigations');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e);
    });
  }

  // Search investigations
  async search(query) {
    const all = await this.getAllInvestigations();
    if (!query) return all;

    const lowerQuery = query.toLowerCase();
    return all.filter(item =>
      item.id.toLowerCase().includes(lowerQuery) ||
      item.title.toLowerCase().includes(lowerQuery) ||
      item.type.toLowerCase().includes(lowerQuery)
    );
  }

  // Get statistics
  async getStats() {
    const all = await this.getAllInvestigations();

    const stats = {
      total: all.length,
      images: all.filter(i => i.type === 'image' || i.type === 'multimodal').length,
      audio: all.filter(i => i.type === 'audio' || i.type === 'multimodal').length,
      errors: all.filter(i => i.status === 'error').length
    };

    return stats;
  }
}

// Global instance
window.localStorageManager = new LocalStorageManager();
