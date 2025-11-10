console.log('events.js loaded');

// Reset Map Button
$('#reset-map').on('click', async () => {
  if (!confirm('Delete DB & regenerate?')) return;

  const $btn = $('#reset-map').prop('disabled', true).text('Deleting...');

  try {
    // 1. Close the open connection (if any)
    if (DB.db) {
      DB.db.close();
      DB.db = null;
      console.log('Closed existing DB connection');
    }

    // 2. Delete the database
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('infinite');

      req.onsuccess = () => {
        console.log('Database deleted');
        resolve();
      };
      req.onerror = () => reject(req.error);

      // NOTE: onblocked will **no longer fire** because we closed the connection
      // Keep it just for safety (e.g. another hidden tab)
      req.onblocked = () => reject(new Error('DB blocked – close other tabs'));
    });

    // 3. Re-open with the correct schema
    await DB.open('infinite', 1, db => {
      if (!db.objectStoreNames.contains('nodes')) {
        db.createObjectStore('nodes', { keyPath: 'id' });
      }
    });

    console.log('DB reset – generating new map...');
    const nodes = await NodeMap.generateFullMap();

    // 4. Reload the page so the UI picks up the fresh data
    location.reload();
  } catch (err) {
    console.error('Reset failed:', err);
    alert('Reset failed: ' + err.message);
  } finally {
    $btn.prop('disabled', false).text('Reset Map');
  }
});

// Safe export
window.enableResetButton = window.enableResetButton || function() {
  $('#reset-map').prop('disabled', false);
  console.log('Reset button enabled');
};