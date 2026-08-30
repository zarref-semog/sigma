const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGraph, edgeKey, shortestPath } = require('../services/pathfinder');

const points = [
  { id: 'A', x: 0, y: 0 }, { id: 'B', x: 1, y: 0 },
  { id: 'C', x: 2, y: 0 }, { id: 'D', x: 1, y: 1 },
];
const graph = buildGraph(points, [
  { from: 'A', to: 'B' }, { from: 'B', to: 'C' },
  { from: 'A', to: 'D' }, { from: 'D', to: 'C' },
]);

test('escolhe o menor caminho disponível', () => {
  assert.deepEqual(shortestPath(graph, 'A', 'C').nodes, ['A', 'B', 'C']);
});

test('evita trecho reservado e seleciona rota alternativa', () => {
  const blocked = new Set([edgeKey('A', 'B')]);
  assert.deepEqual(shortestPath(graph, 'A', 'C', blocked).nodes, ['A', 'D', 'C']);
});

test('considera a reserva nos dois sentidos', () => {
  const blocked = new Set([edgeKey('B', 'A'), edgeKey('A', 'D')]);
  assert.equal(shortestPath(graph, 'A', 'C', blocked), null);
});

test('evita pontos ocupados e utiliza outro caminho', () => {
  const blockedNodes = new Set(['B']);
  assert.deepEqual(shortestPath(graph, 'A', 'C', new Set(), blockedNodes).nodes, ['A', 'D', 'C']);
});
