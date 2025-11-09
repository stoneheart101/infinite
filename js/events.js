
// $(async function () {
//   // -------------------------------------------------
//   // 2. Save – **no key passed** → uses auto-increment
//   // -------------------------------------------------
//   $('#save').on('click', async () => {
//     const name  = $('#name').val().trim();
//     const score = parseInt($('#score').val());
//     if (!name || isNaN(score)) return alert('Fill name & score');

//     // key === undefined → wrapper calls .add()
//     await DB.put('scores', { name, score, ts: Date.now() });
//     $log.append(`Saved: ${name} = ${score}\n`);
//   });

//   // -------------------------------------------------
//   // 3. Load / Clear (unchanged)
//   // -------------------------------------------------
//   $('#load').on('click', async () => {
//     const data = await DB.getAll('scores');
//     $log.append("All scores:\n" + JSON.stringify(data, null, 2) + "\n");
//   });

//   $('#clear').on('click', async () => {
//     await DB.clear('scores');
//     $log.append("DB cleared!\n");
//   });
// });

console.log('events.js loaded');