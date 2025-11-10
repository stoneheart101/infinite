// js/rng.js
// ---------------------------------------------------------------
// Deterministic pseudo-random number generator (Mulberry32)
// ---------------------------------------------------------------

let _seed = 12345;                     // <-- change this to get a new map
let random = mulberry32(_seed);

/**
 * Mulberry32 – fast, 32-bit PRNG.
 * Returns a float in [0,1).
 */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a ^ (a >>> 15);
    t = (t * 0xCA4BDEA9) | 0;
    t ^= t >>> 15;
    return (t >>> 0) / 0x100000000;
  };
}

/**
 * Public setter – called from the page (e.g. setRandomSeed(Date.now()))
 */
window.setRandomSeed = function (s) {
  _seed = Number(s) || 12345;
  random = mulberry32(_seed);
  console.log(`[RNG] Seed set to ${_seed}`);
};

/**
 * Global helper used everywhere instead of Math.random()
 */
window.rand = () => random();