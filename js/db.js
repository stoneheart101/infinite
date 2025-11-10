/**
 * js/db.js
 * Tiny IndexedDB wrapper – safe open/close, put/get/delete, clear.
 * All methods return native Promises.
 */
const DB = {
  db: null,

  /** Throw if DB.open() has not been awaited yet */
  _check() {
    if (!this.db) throw new Error('DB not initialized – await DB.open() first.');
  },

  /** Open (or create) the DB. `upgradeFn` runs only on version change. */
  async open(name, version, upgradeFn) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version);

      req.onupgradeneeded = e => {
        try {
          const db = e.target.result;
          if (upgradeFn) upgradeFn(db);
        } catch (err) {
          reject(err);
        }
      };

      req.onsuccess = e => {
        DB.db = e.target.result;
        resolve(DB);
      };

      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('DB blocked – close other tabs'));
    });
  },

  /** Put a record – works with objects that have a `keyPath` **or** explicit key */
  async put(store, value, key) {
    this._check();
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(store, 'readwrite');
      const st = tx.objectStore(store);
      const req = key !== undefined ? st.put(value, key) : st.put(value);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);

      // Keep transaction alive until the request finishes
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  },

  /** Get a single record by primary key */
  async get(store, key) {
    this._check();
    return new Promise((res, rej) => {
      const tx = DB.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  /** Return **all** records from a store */
  async getAll(store) {
    this._check();
    return new Promise((res, rej) => {
      const tx = DB.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  /** Empty a whole store */
  async clear(store) {
    this._check();
    if (!DB.db.objectStoreNames.contains(store)) {
      console.warn(`[DB] Store '${store}' does not exist – skipping clear`);
      return;
    }
    const tx = DB.db.transaction(store, 'readwrite');
    await tx.objectStore(store).clear();
    await tx.done;
  },

  /** Delete a single record */
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