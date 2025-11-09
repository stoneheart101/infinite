// const $log = $('#log');

// $(async function () {
//   // -------------------------------------------------
//   // 1. Open DB – create the store **with auto-increment**
//   // -------------------------------------------------
//   await DB.open('infinite', 1, db => {
//     if (!db.objectStoreNames.contains('scores')) {
//       // auto-increment primary key → no key needed when adding
//       db.createObjectStore('scores', { autoIncrement: true });
//     }
//   });
//   $log.append("IndexedDB ready: 'infinite' v1\n");

// });

console.log('init.js loaded');