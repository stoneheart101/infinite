// js/rng.js   (new file)
let _seed = 12345;          // <-- change this number to get a new map

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a ^ a >>> 15;
    t = (t * 0xCA4BDEA9) | 0;
    t ^= t >>> 15;
    return (t >>> 0) / 0x100000000;
  };
}

let random = mulberry32(_seed);

// expose a setter (you’ll call it from the page)
window.setRandomSeed = function(s) {
  _seed = Number(s) || 12345;
  random = mulberry32(_seed);
  console.log('RNG seed set to', _seed);
};

// replace the global Math.random() **only** for our code
window.rand = function() { return random(); };