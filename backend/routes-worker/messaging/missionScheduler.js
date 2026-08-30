const amqp = require('amqplib');
const { env } = require('../config/env');
const { rpcRequest } = require('./rpcClient');
const { assignMission, reconcileFinishedMissionAgvs, reconcileIdleAgvsToCharging } = require('../services/routePlanner');
const { fairPendingMissions } = require('../services/missionPriority');
const { getSettings } = require('../services/settings');
const logger = require('../utils/logger');

let reconciliationRunning = false;
const queuedMissionIds = new Set();
const assignmentFailures = new Map();
const FAILURE_LOG_INTERVAL_MS = 60000;

async function startMissionScheduler() {
  const connection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('sigma.mission.dispatch', { durable: true, maxPriority: 3 });
  channel.prefetch(env.CONCURRENCY);

  async function enqueuePendingMissions() {
    if (reconciliationRunning) return;
    reconciliationRunning = true;
    try {
      const missions = await rpcRequest('sigma.missions', { method: 'GET', path: '/api/missions', query: {}, body: {} });
      const pending = fairPendingMissions(missions);
      let enqueued = 0;
      for (const mission of pending) {
        const missionId = String(mission._id);
        if (queuedMissionIds.has(missionId)) continue;
        queuedMissionIds.add(missionId);
        channel.sendToQueue('sigma.mission.dispatch', Buffer.from(JSON.stringify({ missionId: String(mission._id), projectId: mission.projectId, priority: mission.priority })), {
          contentType: 'application/json', persistent: true, priority: 1, messageId: String(mission._id),
        });
        enqueued += 1;
      }
      if (enqueued) logger.debug('Missões pendentes adicionadas à fila de despacho.', { pending: pending.length, enqueued, alreadyQueued: pending.length - enqueued });
    } catch (error) {
      logger.error('Não foi possível reconciliar as missões pendentes.', { error });
    } finally {
      reconciliationRunning = false;
    }
  }

  await channel.consume('sigma.mission.dispatch', async (message) => {
    if (!message) return;
    let mission = {};
    try {
      mission = JSON.parse(message.content.toString());
      const assignment = await assignMission({ missionId: mission.missionId, projectId: mission.projectId });
      assignmentFailures.delete(String(mission.missionId));
      logger.info('Missão atribuída pelo escalonador.', { missionId: mission.missionId, projectId: mission.projectId, priority: mission.priority, agvId: assignment.agv.id, agvName: assignment.agv.name, distance: assignment.distance, pathPoints: assignment.path.length });
    } catch (error) {
      if ([404, 409].includes(error.status)) {
        const missionId = String(mission.missionId || 'desconhecida');
        const previous = assignmentFailures.get(missionId);
        const now = Date.now();
        const context = { missionId: mission.missionId, projectId: mission.projectId, status: error.status, reason: error.message };
        if (!previous || previous.reason !== error.message || now - previous.timestamp >= FAILURE_LOG_INTERVAL_MS) {
          logger.warn('Missão não pôde ser atribuída neste ciclo.', context);
          assignmentFailures.set(missionId, { reason: error.message, timestamp: now });
        } else {
          logger.debug('Tentativa de atribuição adiada.', context);
        }
      } else logger.error('Falha ao atribuir missão pendente.', { missionId: mission.missionId, error });
    } finally {
      if (mission.missionId) queuedMissionIds.delete(String(mission.missionId));
      channel.ack(message);
    }
  });

  async function scheduleReconciliation() {
    await enqueuePendingMissions();
    await reconcileFinishedMissionAgvs().catch((error) => logger.error('Não foi possível reconciliar missões finalizadas.', { error }));
    await reconcileIdleAgvsToCharging().catch((error) => logger.error('Não foi possível reconciliar os retornos à carga.', { error }));
    const settings = await getSettings().catch(() => ({ schedulerIntervalSeconds: env.SCHEDULER_INTERVAL / 1000 }));
    const timer = setTimeout(scheduleReconciliation, settings.schedulerIntervalSeconds * 1000);
    timer.unref();
  }
  await scheduleReconciliation();
  logger.info('Escalonador de missões ativo por prioridade.', { concurrency: env.CONCURRENCY });
}

module.exports = { startMissionScheduler };
