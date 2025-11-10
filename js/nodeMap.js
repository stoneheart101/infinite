/// js/nodeMap.js
/// ---------------------------------------------------------------
///  Map generation – two-layer “inner-terrain” model
///  • Normal (outer) areas → 2-4 per map
///  • Deep (inner) areas  → 1-2 per normal biome, nested inside it
///  • Intra-area connections → organic growth (1-2 parents)
///  • Inter-area bridges   → only between matching biomes (deep ↔ its normal)
/// ---------------------------------------------------------------

// -----------------------------------------------------------------
// 1. Tiny geometry helpers
// -----------------------------------------------------------------
function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function findClosest(node, list) {
  if (!list.length) return null;
  return list.reduce((best, cur) => {
    const d = distance(node, cur);
    return (!best || d < best.dist) ? { node: cur, dist: d } : best;
  }, null).node;
}
function connectBidirectional(a, b, locked = false) {
  a.neighbors.push({ id: b.id, locked });
  b.neighbors.push({ id: a.id, locked });
}
function areConnected(a, b) {
  return a.neighbors.some(n => n.id === b.id);
}
function groupBy(arr, key) {
  return arr.reduce((map, item) => {
    const k = item[key];
    if (!map[k]) map[k] = [];
    map[k].push(item);
    return map;
  }, {});
}

// -----------------------------------------------------------------
// 2. Biome hierarchy (normal ↔ deep)
// -----------------------------------------------------------------
const BIOME_TREE = {
  forest:   { normal: 'forest',   deep: 'deep_forest'   },
  desert:   { normal: 'desert',   deep: 'deep_desert'   },
  mountain: { normal: 'mountain', deep: 'deep_mountain' }
};
const NORMAL_BIOMES = Object.values(BIOME_TREE).map(o => o.normal);
const DEEP_BIOMES   = Object.values(BIOME_TREE).map(o => o.deep);

// -----------------------------------------------------------------
// 3. Phase 1 – Grow nodes **inside** a single area
// -----------------------------------------------------------------
function connectInArea(newNode, areaNodes, openNodesMap) {
  // Candidates = nodes that still have <3 neighbours
  const candidates = Array.from(openNodesMap.values())
    .filter(n => n.area === newNode.area);

  if (candidates.length === 0) {
    // Fallback: connect to the geographically closest node in the area
    const fallback = findClosest(newNode, areaNodes);
    if (fallback) connectBidirectional(newNode, fallback);
    return;
  }

  // Pick 1-2 parents, biased toward closer nodes
  const sorted = candidates
    .map(n => ({ node: n, dist: distance(newNode, n) }))
    .sort((a, b) => a.dist - b.dist);

  const connectCount = rand() < 0.7 ? 1 : 2;
  const parents = sorted.slice(0, connectCount).map(o => o.node);

  for (const parent of parents) {
    connectBidirectional(newNode, parent);
    // Once a node reaches 3 neighbours it is no longer “open”
    if (parent.neighbors.length >= 3) openNodesMap.delete(parent.id);
  }

  // New node becomes open if it still has room
  if (newNode.neighbors.length < 3) openNodesMap.set(newNode.id, newNode);
}

// -----------------------------------------------------------------
// 4. Phase 2 – Inter-area bridges (inner-terrain rule)
// -----------------------------------------------------------------
function getParentBiome(biome) {
  // "deep_forest" → "forest"
  return biome.startsWith('deep_') ? biome.slice(5) : null;
}
function canBridge(a, b) {
  // same biome (normal ↔ normal OR deep ↔ deep)
  if (a.biome === b.biome) return true;

  // deep ↔ its own normal parent
  const aParent = getParentBiome(a.biome);
  const bParent = getParentBiome(b.biome);
  if (aParent && b.biome === aParent) return true;
  if (bParent && a.biome === bParent) return true;

  return false; // no cross-deep, no normal-to-other-normal
}

/** Pick the outermost 30 % of nodes in an area – good bridge candidates */
function getBorderNodes(areaGroup) {
  const cx = areaGroup.reduce((s, n) => s + n.x, 0) / areaGroup.length;
  const cy = areaGroup.reduce((s, n) => s + n.y, 0) / areaGroup.length;
  const center = { x: cx, y: cy };

  return areaGroup
    .map(n => ({ node: n, distFromCenter: distance(n, center) }))
    .sort((a, b) => b.distFromCenter - a.distFromCenter)
    .slice(0, Math.ceil(areaGroup.length * 0.3))
    .map(o => o.node);
}

/** Build 1-2 bridges per biome, respecting canBridge() */
async function createBiomeBridges() {
  const allNodes = await DB.getAll('nodes');
  const byBiome = groupBy(allNodes, 'biome');

  for (const [biome, nodes] of Object.entries(byBiome)) {
    const byArea = groupBy(nodes, 'area');
    const areaList = Object.values(byArea);
    if (areaList.length < 2) continue; // need at least two areas

    // Border nodes that still have free neighbour slots
    const borderByArea = areaList.map(area => ({
      areaId: area[0].area,
      nodes: getBorderNodes(area).filter(n => n.neighbors.length < 3)
    }));

    const candidates = borderByArea
      .flatMap(g => g.nodes.map(n => ({ node: n, area: g.areaId })));

    if (candidates.length < 2) continue;

    const bridgesToMake = rand() < 0.5 ? 1 : 2;
    let made = 0;
    const used = new Set();

    // ---- try to satisfy the random quota -----------------------
    outer:
    for (const a of candidates) {
      if (used.has(a.node.id)) continue;
      for (const b of candidates) {
        if (used.has(b.node.id)) continue;
        if (a.area === b.area) continue;
        if (areConnected(a.node, b.node)) continue;
        if (!canBridge(a.node, b.node)) continue;

        connectBidirectional(a.node, b.node);
        await DB.put('nodes', a.node);
        await DB.put('nodes', b.node);
        used.add(a.node.id);
        used.add(b.node.id);
        if (++made >= bridgesToMake) break outer;
      }
    }

    // ---- guarantee at least ONE bridge (fallback) -------------
    if (made === 0) {
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i], b = candidates[j];
          if (a.area === b.area) continue;
          if (areConnected(a.node, b.node)) continue;
          if (canBridge(a.node, b.node)) {
            connectBidirectional(a.node, b.node);
            await DB.put('nodes', a.node);
            await DB.put('nodes', b.node);
            break;
          }
        }
      }
    }

    console.log(`[BRIDGE] Biome "${biome}" – ${made || 'fallback'} bridge(s) created`);
  }
}

// -----------------------------------------------------------------
// 5. Public API – generate / load the whole map
// -----------------------------------------------------------------
const NodeMap = {
  /** -------------------------------------------------------------
   *  generateFullMap()
   *  1. Create normal areas (2-4)
   *  2. For each normal biome create 1-2 deep areas (nested)
   *  3. Grow nodes inside each area
   *  4. Persist every node
   *  5. Build biome bridges
   *  ------------------------------------------------------------- */
  async generateFullMap() {
    const openNodesMap = new Map();   // nodes with <3 neighbours
    const allGenerated = [];

    // ---------- 1. Normal (outer) areas -------------------------
    const normalAreas = [];
    const normalCount = 2 + Math.floor(rand() * 3); // 2-4
    for (let i = 0; i < normalCount; i++) {
      const biome = NORMAL_BIOMES[Math.floor(rand() * NORMAL_BIOMES.length)];
      const area = {
        id: `normal_${i}`,
        biome,
        isDeep: false,
        targetNodeCount: 4 + Math.floor(rand() * 5) // 4-8
      };
      console.log(`[NORMAL] Creating ${area.id} | biome:${biome} | nodes:${area.targetNodeCount}`);
      normalAreas.push(area);
    }

    // ---------- 2. Deep (inner) areas ---------------------------
    const deepAreas = [];
    const normalByBiome = groupBy(normalAreas, 'biome');
    for (const [biome, list] of Object.entries(normalByBiome)) {
      const deepCount = rand() < 0.7 ? 1 : 2;
      const deepBiome = BIOME_TREE[biome].deep;
      for (let j = 0; j < deepCount; j++) {
        const area = {
          id: `deep_${biome}_${j}`,
          biome: deepBiome,
          isDeep: true,
          parentBiome: biome,
          targetNodeCount: 2 + Math.floor(rand() * 3) // 2-4 (smaller)
        };
        console.log(`[DEEP] Creating ${area.id} | parent:${biome} | nodes:${area.targetNodeCount}`);
        deepAreas.push(area);
      }
    }

    const allAreas = [...normalAreas, ...deepAreas];

    // ---------- 3. Grow nodes per area -------------------------
    for (const area of allAreas) {
      const areaNodes = [];

      // ---- origin node (center of the area) -----------------
      const originX = (rand() - 0.5) * 800;
      const originY = (rand() - 0.5) * 800;
      const first = {
        id: `n_${Date.now()}_${rand()}`.replace('.', ''),
        area: area.id,
        biome: area.biome,
        x: originX,
        y: originY,
        neighbors: []
      };
      areaNodes.push(first);
      openNodesMap.set(first.id, first);
      allGenerated.push(first);

      // ---- grow until target count ---------------------------
      while (areaNodes.length < area.targetNodeCount) {
        let nx, ny;

        if (area.isDeep) {
          // Keep deep nodes clustered inside their parent normal area
          const parentArea = normalAreas.find(a => a.biome === area.parentBiome);
          const parentCenter = {
            x: parentArea.nodes?.[0]?.x ?? originX,
            y: parentArea.nodes?.[0]?.y ?? originY
          };
          nx = parentCenter.x + (rand() - 0.5) * 180;
          ny = parentCenter.y + (rand() - 0.5) * 180;
        } else {
          nx = originX + (rand() - 0.5) * 350;
          ny = originY + (rand() - 0.5) * 350;
        }

        const newNode = {
          id: `n_${Date.now()}_${rand()}`.replace('.', ''),
          area: area.id,
          biome: area.biome,
          x: nx,
          y: ny,
          neighbors: []
        };

        connectInArea(newNode, areaNodes, openNodesMap);
        areaNodes.push(newNode);
        allGenerated.push(newNode);
      }

      // Store reference for deep-area centering (used later)
      area.nodes = areaNodes;

      // ---- persist every node --------------------------------
      for (const node of areaNodes) {
        await DB.put('nodes', node);
        console.log(`[PERSIST] ${node.id.slice(-6)} | area:${area.id} | biome:${area.biome} | deep:${area.isDeep}`);
      }
      console.log(`[AREA] Saved ${areaNodes.length} nodes for ${area.id} (${area.biome})`);
    }

    // ---------- 4. Biome bridges --------------------------------
    await createBiomeBridges();

    console.log(`[MAP] Generation complete – ${allGenerated.length} nodes total`);
    return allGenerated;
  },

  /** Load an already-persisted map */
  async loadMap() {
    const nodes = await DB.getAll('nodes');
    console.log(`[LOAD] ${nodes.length} nodes loaded from IndexedDB`);
    return nodes;
  }
};