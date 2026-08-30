const test = require('node:test');
const assert = require('node:assert/strict');
const { fairPendingMissions } = require('../services/missionPriority');

test('alterna prioridades e preserva FIFO em cada fila', () => {
  const missions = [
    { _id: 'low', projectId: 'p', status: 'Pending', priority: 'Low', createdAt: '2026-01-01' },
    { _id: 'medium', projectId: 'p', status: 'Pending', priority: 'Medium', createdAt: '2026-01-01' },
    { _id: 'new-high', projectId: 'p', status: 'Pending', priority: 'High', createdAt: '2026-01-03' },
    { _id: 'old-high', projectId: 'p', status: 'Pending', priority: 'High', createdAt: '2026-01-02' },
    { _id: 'done', projectId: 'p', status: 'Completed', priority: 'High', createdAt: '2026-01-01' },
  ];
  assert.deepEqual(fairPendingMissions(missions).map((mission) => mission._id), ['old-high', 'medium', 'low', 'new-high']);
});
