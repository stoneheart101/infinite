/// ──────────────────────────────────────────────────────────────
// UTILS (unchanged)
// ──────────────────────────────────────────────────────────────
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function findClosest(node, list) {
  if (list.length === 0) return null;
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

// ──────────────────────────────────────────────────────────────
// BIOME HIERARCHY
// ──────────────────────────────────────────────────────────────
const BIOME_TREE = {
  forest:   { normal: 'forest',   deep: 'deep_forest'   },
  desert:   { normal: 'desert',   deep: 'deep_desert'   },
  mountain: { normal: 'mountain', deep: 'deep_mountain' }
};
const NORMAL_BIOMES = Object.values(BIOME_TREE).map(o => o.normal);
const DEEP_BIOMES   = Object.values(BIOME_TREE).map(o => o.deep);

// ──────────────────────────────────────────────────────────────
// PHASE 1: Intra-area connection (unchanged logic, depth removed)
// ──────────────────────────────────────────────────────────────
function connectInArea(newNode, areaNodes, openNodesMap) {
  const candidates = Array.from(openNodesMap.values())
    .filter(n => n.area === newNode.area);

  if (candidates.length === 0) {
    const fallback = findClosest(newNode, areaNodes);
    if (fallback) connectBidirectional(newNode, fallback, false);
    return;
  }

  const sorted = candidates
    .map(n => ({ node: n, dist: distance(newNode, n) }))
    .sort((a, b) => a.dist - b.dist);

  const connectCount = window.rand() < 0.7 ? 1 : 2;
  const parents = sorted.slice(0, connectCount).map(o => o.node);

  for (const parent of parents) {
    connectBidirectional(newNode, parent, false);
    if (parent.neighbors.length >= 3) {
      openNodesMap.delete(parent.id);
    }
  }

  if (newNode.neighbors.length < 3) {
    openNodesMap.set(newNode.id, newNode);
  }
}

// ──────────────────────────────────────────────────────────────
// PHASE 2: Inter-area bridges – **inner-terrain rule**
// ──────────────────────────────────────────────────────────────
function getParentBiome(biome) {
  // "deep_forest" → "forest"
  if (biome.startsWith('deep_')) return biome.slice(5);
  return null;
}
function canBridge(a, b) {
  // same biome (normal ↔ normal  OR  deep ↔ deep)
  if (a.biome === b.biome) return true;

  // deep ↔ its own normal parent
  const aParent = getParentBiome(a.biome);
  const bParent = getParentBiome(b.biome);
  if (aParent && b.biome === aParent) return true;
  if (bParent && a.biome === bParent) return true;

  return false;   // no cross-deep, no normal-to-other-normal bridges
}

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

async function createBiomeBridges() {
  const allNodes = await DB.getAll('nodes');
  const byBiome = groupBy(allNodes, 'biome');

  for (const [biome, nodes] of Object.entries(byBiome)) {
    const byArea = groupBy(nodes, 'area');
    const areaList = Object.values(byArea);
    if (areaList.length < 2) continue;

    const borderNodesByArea = areaList.map(area => ({
      areaId: area[0].area,
      nodes: getBorderNodes(area).filter(n => n.neighbors.length < 3)
    }));

    const candidates = borderNodesByArea
      .flatMap(g => g.nodes.map(n => ({ node: n, area: g.areaId })));

    if (candidates.length < 2) continue;

    const bridgesToMake = window.rand() < 0.5 ? 1 : 2;
    let made = 0;
    const used = new Set();

    // try to build bridges respecting canBridge()
    outer: for (const a of candidates) {
      if (used.has(a.node.id)) continue;
      for (const b of candidates) {
        if (used.has(b.node.id)) continue;
        if (a.area === b.area) continue;
        if (areConnected(a.node, b.node)) continue;
        if (!canBridge(a.node, b.node)) continue;

        connectBidirectional(a.node, b.node, false);
        await DB.put('nodes', a.node);
        await DB.put('nodes', b.node);
        used.add(a.node.id);
        used.add(b.node.id);
        if (++made >= bridgesToMake) break outer;
      }
    }

    // fallback: guarantee at least one valid bridge
    if (made === 0) {
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i], b = candidates[j];
          if (a.area === b.area) continue;
          if (areConnected(a.node, b.node)) continue;
          if (canBridge(a.node, b.node)) {
            connectBidirectional(a.node, b.node, false);
            await DB.put('nodes', a.node);
            await DB.put('nodes', b.node);
            break;
          }
        }
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// MAIN: Generate full map (single layer, inner-terrain nesting)
// ──────────────────────────────────────────────────────────────
const NodeMap = {
  async generateFullMap() {
    const openNodesMap = new Map();
    const allGenerated = [];

    // ── 1. Normal (outer) areas ─────────────────────────────────────
    const normalAreas = [];
    const normalCount = 2 + Math.floor(rand() * 2); // 2-4
    for (let i = 0; i < normalCount; i++) {
      const biome = NORMAL_BIOMES[Math.floor(rand() * NORMAL_BIOMES.length)];

      var newNormalArea = {
        id: `normal_${i}`,
        biome,
        isDeep: false,
        targetNodeCount: 4 + Math.floor(rand() * 4) // 4-8
      };

      console.log('Creating normal area:', newNormalArea.id, 'biome:', biome, 'count:', newNormalArea.targetNodeCount);

      normalAreas.push(newNormalArea);
    }

    // ── 2. Deep (inner) areas – one or, maybe two, per normal biome ─────
    const deepAreas = [];
    const normalByBiome = groupBy(normalAreas, 'biome');
    for (const [biome, list] of Object.entries(normalByBiome)) {
      const deepCount = window.rand() < 0.7 ? 1 : 2;
      const deepBiome = BIOME_TREE[biome].deep;
      for (let j = 0; j < deepCount; j++) {

        var newDeepArea = {
          id: `deep_${biome}_${j}`,
          biome: deepBiome,
          isDeep: true,
          parentBiome: biome,
          targetNodeCount: 2 + Math.floor(rand() * 2) // 15-25
        };

        console.log('Creating deep area:', newDeepArea.id, 'biome:', deepBiome, 'count:', newDeepArea.targetNodeCount);

        deepAreas.push(newDeepArea);
      }
    }

    const allAreas = [...normalAreas, ...deepAreas];

    console.log(allAreas);

    // ── 3. Generate nodes for each area ─────────────────────────────
    for (const area of allAreas) {
      const areaNodes = [];

      // ---- first node (origin) ------------------------------------
      const originX = (window.rand() - 0.5) * 800;
      const originY = (window.rand() - 0.5) * 800;
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

      // ---- grow the area -----------------------------------------
      while (areaNodes.length < area.targetNodeCount) {
        let nx, ny;

        if (area.isDeep) {
          // keep deep nodes clustered inside their parent area
          const parentArea = normalAreas.find(a => a.biome === area.parentBiome);
          const parentCenter = {
            x: parentArea.nodes?.[0]?.x ?? originX,
            y: parentArea.nodes?.[0]?.y ?? originY
          };
          nx = parentCenter.x + (window.rand() - 0.5) * 180;
          ny = parentCenter.y + (window.rand() - 0.5) * 180;
        } else {
          nx = originX + (window.rand() - 0.5) * 350;
          ny = originY + (window.rand() - 0.5) * 350;
        }

        const newNode = {
          id: `n_${Date.now()}_${window.rand()}`.replace('.', ''),
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

      // store reference for deep-area centering
      area.nodes = areaNodes;

      

      // ---- persist area -----------------------------------------
      
      for (const node of areaNodes) {
        console.log(`Persisting node ${node.id} for area ${area.id}`);
        await DB.put('nodes', node);
      }
      
      console.log(`Saved ${areaNodes.length} nodes for ${area.id} (${area.biome})`);
    }

    // ── 4. Biome bridges (inner-terrain rule) ───────────────────────
    await createBiomeBridges();

    console.log('Map generated:', allGenerated.length, 'nodes');
    return allGenerated;
  },

  async loadMap() {
    return await DB.getAll('nodes');
  }
};