// js/d3Adapter.js
const D3Adapter = {
  // ------------------------------------------------------------------ COLOUR PALETTE
  // CSS variables keep the palette in sync with Bootstrap dark theme
  biomeBase: {
    forest: 'var(--bs-success)',   // #198754
    desert: 'var(--bs-warning)',   // #ffc107
    plains: 'var(--bs-info)'       // #0dcaf0
  },

  // deep = 70 % darker (simple multiply)
  darken(hex, factor = 0.7) {
    const clean = hex.replace('#', '');
    const rgb = parseInt(clean, 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    return `#${((1 << 24) + (Math.round(r * factor) << 16) + (Math.round(g * factor) << 8) + Math.round(b * factor))
      .toString(16).slice(1)}`;
  },

  colour(d) {
    const base = getComputedStyle(document.documentElement)
                 .getPropertyValue(this.biomeBase[d.biome]).trim() || '#888';
    return d.depth === 'deep' ? this.darken(base, 0.7) : base;
  },

  // ------------------------------------------------------------------ GRAPH CONVERSION
  toGraphData(nodes) {
    const links = [];
    nodes.forEach(n => {
      n.neighbors.forEach(nb => {
        if (n.id < nb.targetId) {               // undirected → one link
          links.push({ source: n.id, target: nb.targetId });
        }
      });
    });
    return { nodes: nodes.map(n => ({ ...n })), links };
  }
};