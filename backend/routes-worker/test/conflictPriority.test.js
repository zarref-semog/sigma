const test = require('node:test');
const assert = require('node:assert/strict');
const { requesterHasPriority } = require('../messaging/robotEvents');

test('missão de prioridade maior recebe passagem', () => {
  assert.equal(requesterHasPriority(
    { priority: 'High', createdAt: '2026-01-02' },
    { priority: 'Medium', createdAt: '2026-01-01' },
  ), true);
});

test('em prioridades iguais a missão mais antiga recebe passagem', () => {
  assert.equal(requesterHasPriority(
    { priority: 'Medium', createdAt: '2026-01-01' },
    { priority: 'Medium', createdAt: '2026-01-02' },
  ), true);
  assert.equal(requesterHasPriority(
    { priority: 'Medium', createdAt: '2026-01-03' },
    { priority: 'Medium', createdAt: '2026-01-02' },
  ), false);
});
