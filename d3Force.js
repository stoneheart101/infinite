// js/d3Force.js
function renderMap(nodesRaw) {
  const { nodes, links } = D3Adapter.toGraphData(nodesRaw);

  const container = d3.select('#d3-root');
  const width  = container.node().clientWidth;
  const height = container.node().clientHeight;

  // ------------------------------------------------------------------ SVG
  const svg = container.append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('width', '100%')
    .attr('height', '100%')
    .style('background', 'var(--bs-dark)');

  // ------------------------------------------------------------------ FORCE
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(90))
    .force('charge', d3.forceManyBody().strength(-350))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(22));

  // ------------------------------------------------------------------ LINKS
  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#555')
    .attr('stroke-width', 2);

  // ------------------------------------------------------------------ NODES
  const node = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 18)                     // fixed size
    .attr('fill', d => D3Adapter.colour(d));

  // ------------------------------------------------------------------ LABELS (always visible)
  const label = svg.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.title)
    .attr('font-size', 11)
    .attr('fill', '#fff')
    .attr('text-anchor', 'middle')
    .attr('dy', '.35em')
    .attr('pointer-events', 'none');

  // ------------------------------------------------------------------ TICK
  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

    node.attr('cx', d => d.x)
        .attr('cy', d => d.y);

    label.attr('x', d => d.x)
          .attr('y', d => d.y);
  });

  // start the layout
  simulation.alpha(1).restart();
}