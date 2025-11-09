// js/nodeMap.js  (replace the old file)
const NodeMap = {
  // ------------------------------------------------------------------ NAME LISTS
  nameParts: {
    forest: {
      adjs: ['Dark','Misty','Ancient','Cursed','Shadowed','Eternal','Bloodied','Golden'],
      nouns:['Woods','Grove','Thicket','Glade','Canopy','Hollow']
    },
    desert: {
      adjs: ['Scorching','Endless','Sun-Blasted','Crimson','Shifting','Forgotten','Bone'],
      nouns:['Dunes','Wastes','Sands','Barrens','Tombs']
    },
    plains: {
      adjs: ['Vast','Golden','Wind-Swept','Rolling','Savage'],
      nouns:['Steppes','Fields','Grasslands','Savanna']
    }
  },

  randPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; },

  // ------------------------------------------------------------------ BUNCH GEN
  generateBunch(biome, isDeep = false){
    console.log(`Generating ${isDeep?'deep':'regular'} bunch for biome '${biome}'`);

    const size = isDeep ? (1+Math.floor(Math.random()*3)) : (5+Math.floor(Math.random()*4));
    const featureId = `${biome}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const nodes = [];

    for(let i=0;i<size;i++){
      nodes.push({
        id: `n_${featureId}_${i}`,
        title: `${this.randPick(this.nameParts[biome].adjs)} ${this.randPick(this.nameParts[biome].nouns)}`,
        biome, depth: isDeep?'deep':'regular', featureId,
        neighbors:[]
      });
    }

    // internal connections (approx 2 edges per node, keep 1-3 max)
    for(let i=0;i<size*2;i++){
      const a = Math.floor(Math.random()*size);
      const b = (a+1+Math.floor(Math.random()*(size-1)))%size;
      if(a===b) continue;
      if(nodes[a].neighbors.some(e=>e.targetId===nodes[b].id)) continue;
      nodes[a].neighbors.push({targetId:nodes[b].id});
      nodes[b].neighbors.push({targetId:nodes[a].id});
    }

    nodes.forEach(n=>n.neighbors=n.neighbors.slice(0,3));

    console.log(`Finalized ${nodes.length} nodes of biome '${biome}' with up to 3 neighbors each`);
    return nodes;
  },

  // ------------------------------------------------------------------ CONNECTION RULES
  canConnect(n1,n2){
    if(n1.biome!==n2.biome) return false;
    if(n1.depth==='deep' && n2.depth!=='regular') return false;
    if(n2.depth==='deep' && n1.depth!=='regular') return false;
    return n1.neighbors.length<3 && n2.neighbors.length<3;
  },

  // ------------------------------------------------------------------ ATTACH (loads from DB automatically)
  async attachBunch(biome, isDeep = false){
    console.log(`Attaching ${isDeep?'deep':'regular'} bunch for biome '${biome}'`);
    const existing = await DB.getAll('nodes');
    console.log(`Loaded ${existing.length} existing nodes for biome '${biome}'`);

    const newBunch = this.generateBunch(biome, isDeep);
    const frontier = existing.filter(n=>n.biome===biome && n.depth==='regular');

    // first bunch? just return it
    if(frontier.length===0){
      const all = [...existing.map(n=>({...n})), ...newBunch];
      await this.saveAll(all);
      return;
    }

    // pick 1-2 (regular) or 2-3 (deep) anchor points
    const maxAnchors = isDeep ? 3 : 2;
    const anchors = [];
    while(anchors.length < maxAnchors && frontier.length){
      const candIdx = Math.floor(Math.random()*frontier.length);
      const existingNode = frontier[candIdx];
      const newNode = newBunch[Math.floor(Math.random()*newBunch.length)];
      if(this.canConnect(existingNode, newNode)){
        anchors.push({existing:existingNode, new:newNode});
        frontier.splice(candIdx,1); // avoid same node twice
      }
    }

    anchors.forEach(p=>{
      p.existing.neighbors.push({targetId:p.new.id});
      p.new.neighbors.push({targetId:p.existing.id});
      p.existing.neighbors = p.existing.neighbors.slice(0,3);
      p.new.neighbors = p.new.neighbors.slice(0,3);
    });

    const all = [...existing.map(n=>({...n})), ...newBunch];
    await this.saveAll(all);
  },

  // ------------------------------------------------------------------ SAVE ALL (single transaction) – NO CLEAR HERE
  async saveAll(nodes){
    const tx = DB.db.transaction('nodes','readwrite');
    const store = tx.objectStore('nodes');
    for(const n of nodes) await store.put(n);
    await tx.done;
  },

  // ------------------------------------------------------------------ FULL MAP GENERATOR (call once)
  async generateFullMap(){
    console.log('Clearing nodes...');
    await DB.clear('nodes');               // fresh start

    console.log('Generating full map...');
    const biomes = ['forest','desert','plains'];

    for(const biome of biomes){
      // 3 regular bunches
      for(let i=0;i<3;i++) await this.attachBunch(biome);
      // 1 deep pocket
      await this.attachBunch(biome, true);
    }
    console.log('Full map generated & saved');
  },

  // ------------------------------------------------------------------ LOAD FOR DISPLAY
  async loadMap(){ return await DB.getAll('nodes'); }
};