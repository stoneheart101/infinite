/**
 * Tiny IndexedDB wrapper – fixed for auto-increment stores + safety
 */
const DB = {
  db: null,

  _check() {
    if (!this.db) {
      throw new Error('DB not initialized. Await DB.open() first.');
    }
  },

  /** Open (or create) the database */
  async open(name, version, upgradeFn) {
    return new Promise((res, rej) => {
      const req = indexedDB.open(name, version);

      req.onupgradeneeded = e => {
        try {
          const db = e.target.result;
          if (upgradeFn) upgradeFn(db);
        } catch (err) {
          rej(err);
        }
      };

      req.onsuccess = e => {
        DB.db = e.target.result;
        res(DB);
      };

      req.onerror = e => rej(e.target.error);
      req.onblocked = () => rej(new Error('DB blocked – close other tabs'));
    });
  },

  /** Put a value – works with keyPath or explicit key */
  async put(store, value, key) {
    this._check();
    
    return new Promise((resolve, reject) => {
        const tx = DB.db.transaction(store, 'readwrite');
        const st = tx.objectStore(store);
        
        const req = key !== undefined 
        ? st.put(value, key) 
        : st.put(value);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);

        // Crucial: keep transaction alive until this request finishes
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  },

  /** Get by key */
  async get(store, key) {
    this._check();
    return new Promise((res, rej) => {
      const tx = DB.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  /** Get all records */
  async getAll(store) {
    this._check();
    return new Promise((res, rej) => {
      const tx = DB.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  /** Clear a store */
  async clear(store) {
    this._check();
    if (!DB.db.objectStoreNames.contains(store)) {
      console.warn(`Store '${store}' does not exist – skipping clear`);
      return;
    }
    const tx = DB.db.transaction(store, 'readwrite');
    await tx.objectStore(store).clear();
    await tx.done;
  },

  /** Delete by key */
  async delete(store, key) {
    this._check();
    return new Promise((res, rej) => {
      const tx = DB.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }
};