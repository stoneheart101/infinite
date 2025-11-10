// js/events.js
console.log('[events.js] loaded');

/** --------------------------------------------------------------
 *  Reset Map button
 *  --------------------------------------------------------------
 *  1. Close any open DB connection
 *  2. Delete the whole IndexedDB database
 *  3. Re-open with the correct schema
 *  4. Generate a fresh map (NodeMap.generateFullMap)
 *  5. Reload the page so the UI picks up the new data
 */
$('#reset-map').on('click', async () => {
  if (!confirm('Delete DB & regenerate the whole map?')) return;

  const $btn = $('#reset-map').prop('disabled', true).text('Deleting...');

  try {
    // 1. Close existing connection (if any)
    if (DB.db) {
      DB.db.close();
      DB.db = null;
      console.log('[RESET] Closed existing DB connection');
    }

    // 2. Delete the database
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('infinite');

      req.onsuccess = () => {
        console.log('[RESET] Database "infinite" deleted');
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('DB blocked – close other tabs'));
    });

    // 3. Re-open with schema
    await DB.open('infinite', 1, db => {
      if (!db.objectStoreNames.contains('nodes')) {
        db.createObjectStore('nodes', { keyPath: 'id' });
      }
    });
    console.log('[RESET] DB reopened with fresh schema');

    // 4. Generate new map
    console.log('[RESET] Generating new map…');
    await NodeMap.generateFullMap();

    // 5. Reload UI
    location.reload();
  } catch (err) {
    console.error('[RESET] Failed:', err);
    alert('Reset failed: ' + err.message);
  } finally {
    $btn.prop('disabled', false).text('Reset Map');
  }
});

/** --------------------------------------------------------------
 *  Safe export – called from the page after DB is ready
 *  -------------------------------------------------------------- */
window.enableResetButton = window.enableResetButton || function () {
  $('#reset-map').prop('disabled', false);
  console.log('[RESET] Button enabled');
};