function edgeKey(from, to) {
  return [String(from), String(to)].sort().join('::');
}

function buildGraph(points, routes) {
  const graph = new Map(points.map((point) => [point.id, []]));
  for (const route of routes) {
    if (!graph.has(route.from) || !graph.has(route.to)) continue;
    const from = points.find((point) => point.id === route.from);
    const to = points.find((point) => point.id === route.to);
    const weight = Math.hypot(Number(to.x) - Number(from.x), Number(to.y) - Number(from.y)) || 1;
    graph.get(route.from).push({ node: route.to, weight });
    graph.get(route.to).push({ node: route.from, weight });
  }
  return graph;
}

function shortestPath(graph, start, destination, blockedEdges = new Set(), blockedNodes = new Set()) {
  if (!graph.has(start) || !graph.has(destination)) return null;
  if (blockedNodes.has(start) || blockedNodes.has(destination)) return null;
  const distances = new Map([...graph.keys()].map((node) => [node, Infinity]));
  const previous = new Map();
  const unvisited = new Set(graph.keys());
  distances.set(start, 0);

  while (unvisited.size) {
    let current;
    for (const node of unvisited) {
      if (current === undefined || distances.get(node) < distances.get(current)) current = node;
    }
    if (current === undefined || distances.get(current) === Infinity) break;
    unvisited.delete(current);
    if (current === destination) break;
    for (const neighbor of graph.get(current)) {
      if (!unvisited.has(neighbor.node) || blockedNodes.has(neighbor.node) || blockedEdges.has(edgeKey(current, neighbor.node))) continue;
      const candidate = distances.get(current) + neighbor.weight;
      if (candidate < distances.get(neighbor.node)) {
        distances.set(neighbor.node, candidate);
        previous.set(neighbor.node, current);
      }
    }
  }

  if (distances.get(destination) === Infinity) return null;
  const nodes = [destination];
  while (nodes[0] !== start) nodes.unshift(previous.get(nodes[0]));
  return { nodes, distance: distances.get(destination) };
}

module.exports = { buildGraph, edgeKey, shortestPath };
