const amqp = require('amqplib');
const { env } = require('../config/env');
const { advanceReservations, completeMission, dispatchToCharging, failMission, finishChargingReturn, yieldMission } = require('../services/routePlanner');
const { driver } = require('../config/graphDb');
const { rpcRequest } = require('./rpcClient');
const { PointReservation } = require('../models/pointReservation');
const logger = require('../utils/logger');

const priorityRank = { High: 3, Medium: 2, Low: 1 };

function requesterHasPriority(requester, occupant) {
  const requesterRank = priorityRank[requester?.priority] || 0;
  const occupantRank = priorityRank[occupant?.priority] || 0;
  if (requesterRank !== occupantRank) return requesterRank > occupantRank;
  return new Date(requester?.createdAt || 0) < new Date(occupant?.createdAt || 0);
}

function retryOrDiscard(channel, queue, message, error) {
  const retries = Number(message.properties.headers?.['x-sigma-retries'] || 0);
  if (retries < 3) {
    channel.sendToQueue(queue, message.content, {
      contentType: message.properties.contentType || 'application/json',
      persistent: true,
      headers: { ...message.properties.headers, 'x-sigma-retries': retries + 1 },
    });
  } else {
    console.error(`Mensagem descartada após ${retries} retentativas:`, error.message);
  }
  channel.ack(message);
}

function confirmPosition(channel, message, telemetry, accepted, reason, retryable = false, yieldRoute = false) {
  if (!message.properties.replyTo || !telemetry.movementId) return;
  channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify({
    movementId: telemetry.movementId,
    accepted,
    reason,
    retryable,
    yield: yieldRoute,
  })), { contentType: 'application/json', persistent: false });
}

async function requesterMustYield(session, channel, telemetry, occupant, agvs, point) {
  const requesterId = telemetry.agv.missionId;
  const occupantId = occupant.currentMission;
  if (!occupantId && occupant.status === 'Available') {
    try {
      await dispatchToCharging({
        missionId: `clear:${occupant._id}`,
        projectId: telemetry.projectId,
        agvId: String(occupant._id),
        agvName: occupant.name,
        finalPoint: { id: occupant.location },
        battery: occupant.battery,
      });
      logger.warn('AGV disponível foi deslocado para liberar um corredor.', { requestingAgvId: telemetry.agv.id, requestingMissionId: requesterId, displacedAgvId: String(occupant._id), occupiedPointId: point.id });
      return false;
    } catch (error) {
      logger.warn('Não foi possível deslocar o AGV disponível que bloqueia o corredor.', { requestingAgvId: telemetry.agv.id, displacedAgvId: String(occupant._id), occupiedPointId: point.id, reason: error.message });
      return true;
    }
  }
  const [requesterMission, occupantMission] = await Promise.all([
    requesterId && !String(requesterId).startsWith('charge:')
      ? rpcRequest('sigma.missions', { method: 'GET', path: '/api/missions/' + requesterId, query: {}, body: {} }).catch(() => null)
      : null,
    occupantId && !String(occupantId).startsWith('charge:')
      ? rpcRequest('sigma.missions', { method: 'GET', path: '/api/missions/' + occupantId, query: {}, body: {} }).catch(() => null)
      : null,
  ]);
  if (!requesterHasPriority(requesterMission, occupantMission) || !occupantId) return true;

  const current = await PointReservation.findOne({ missionId: occupantId, pointId: point.id, status: 'reserved' }).lean();
  const previous = current?.order > 0
    ? await PointReservation.findOne({ missionId: occupantId, order: current.order - 1 }).lean()
    : null;
  if (!previous) return true;
  const retreatOccupied = agvs.some((agv) =>
    String(agv._id) !== String(occupant._id) &&
    String(agv.location || '') === String(previous.pointId) &&
    agv.status !== 'Offline'
  );
  if (retreatOccupied) return true;

  const result = await session.run(
    'MATCH (point:InterestPoint {projectId: $projectId, id: $pointId}) RETURN point LIMIT 1',
    { projectId: telemetry.projectId, pointId: previous.pointId },
  );
  const retreat = result.records[0]?.get('point')?.properties;
  if (!retreat) return true;
  channel.sendToQueue('sigma.robot.commands', Buffer.from(JSON.stringify({
    type: 'YIELD_ROUTE',
    agvId: String(occupant._id),
    missionId: occupantId,
    retreatPoint: { id: retreat.id, name: retreat.name, rfidTag: retreat.rfidTag },
    reason: 'Missão de maior precedência solicitou passagem.',
  })), { contentType: 'application/json', persistent: true });
  logger.warn('Comando de recuo enviado para liberar a rota.', { requestingAgvId: telemetry.agv.id, requestingMissionId: requesterId, yieldingAgvId: String(occupant._id), yieldingMissionId: occupantId, occupiedPointId: point.id, retreatPointId: retreat.id });
  return false;
}

async function startRobotEventConsumer() {
  const connection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('sigma.robot.events', { durable: true });
  await channel.assertQueue('sigma.robot.telemetry.raw', { durable: true });
  await channel.assertQueue('sigma.robot.telemetry', { durable: true });
  channel.prefetch(1);
  await channel.consume('sigma.robot.events', async (message) => {
    if (!message) return;
    try {
      const event = JSON.parse(message.content.toString());
      logger.info('Evento recebido do robot-gateway.', { eventType: event.type, missionId: event.missionId, projectId: event.projectId, agvId: event.agvId });
      if (event.type === 'ROUTE_COMPLETED') await completeMission(event);
      if (event.type === 'CHARGING_ZONE_REACHED') await finishChargingReturn(event);
      if (event.type === 'ROUTE_FAILED') await failMission(event);
      if (event.type === 'ROUTE_YIELDED') await yieldMission(event);
      channel.ack(message);
    } catch (error) {
      console.error('Erro ao processar retorno do robô:', error);
      retryOrDiscard(channel, 'sigma.robot.events', message, error);
    }
  });
  await channel.consume('sigma.robot.telemetry.raw', async (message) => {
    if (!message) return;
    const session = driver.session();
    try {
      const telemetry = JSON.parse(message.content.toString());
      const result = await session.run(
        `MATCH (point:InterestPoint {projectId: $projectId, rfidTag: $rfidTag})
         RETURN point.id AS id, point.name AS name, point.type AS type, point.x AS x, point.y AS y LIMIT 1`,
        { projectId: telemetry.projectId, rfidTag: telemetry.rfidTag }
      );
      if (!result.records.length) {
        console.warn(`Tag RFID ${telemetry.rfidTag} não encontrada no projeto ${telemetry.projectId}.`);
        confirmPosition(channel, message, telemetry, false, 'Tag RFID não encontrada.');
        channel.ack(message);
        return;
      }
      const record = result.records[0];
      const numeric = (value) => value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value);
      const point = { id: record.get('id'), name: record.get('name'), type: record.get('type'), x: numeric(record.get('x')), y: numeric(record.get('y')), rfidTag: telemetry.rfidTag };
      const enriched = { ...telemetry, type: 'AGV_TELEMETRY', point, agv: { ...telemetry.agv, x: point.x, y: point.y, pointId: point.id, rfidTag: point.rfidTag }, orchestratedAt: new Date().toISOString() };
      const statuses = { 'Executando missão': 'Executing Mission', 'Disponível': 'Available', 'Em carga': 'Charging', Offline: 'Offline' };
      const agvs = await rpcRequest('sigma.agvs', { method: 'GET', path: '/api/agvs', query: {}, body: {} });
      const occupant = agvs.find((agv) => String(agv._id) !== String(telemetry.agv.id) && String(agv.projectId) === String(telemetry.projectId) && String(agv.location || '') === String(point.id) && agv.status !== 'Offline');
      if (occupant) {
        const requesterYields = await requesterMustYield(session, channel, telemetry, occupant, agvs, point);
        logger.warn('Posição do AGV rejeitada por ocupação do ponto.', { projectId: telemetry.projectId, pointId: point.id, pointName: point.name, requestingAgvId: telemetry.agv.id, requestingMissionId: telemetry.agv.missionId, occupantAgvId: String(occupant._id), occupantMissionId: occupant.currentMission, requesterMustYield: requesterYields });
        channel.sendToQueue('sigma.robot.telemetry', Buffer.from(JSON.stringify({ type: 'AGV_POSITION_REJECTED', projectId: telemetry.projectId, agvId: telemetry.agv.id, pointId: point.id, message: `O ponto ${point.name} está ocupado pelo AGV ${occupant.name}.` })), { contentType: 'application/json', persistent: false });
        confirmPosition(channel, message, telemetry, false, `Ponto ocupado pelo AGV ${occupant.name}.`, !requesterYields, requesterYields);
        channel.ack(message);
        return;
      }
      try {
        await advanceReservations(telemetry.agv.missionId, point.id);
      } catch (error) {
        if (!error.collision) throw error;
        const conflictingAgv = agvs.find((agv) =>
          String(agv._id) === String(error.conflictingAgvId) ||
          String(agv.currentMission) === String(error.conflictingMissionId)
        );
        if (conflictingAgv && error.conflictPointId) {
          const conflictResult = await session.run(
            'MATCH (point:InterestPoint {projectId: $projectId, id: $pointId}) RETURN point LIMIT 1',
            { projectId: telemetry.projectId, pointId: error.conflictPointId },
          );
          const conflictPoint = conflictResult.records[0]?.get('point')?.properties || { id: error.conflictPointId, name: error.conflictPointId };
          const requesterYields = await requesterMustYield(session, channel, telemetry, conflictingAgv, agvs, conflictPoint);
          logger.warn('Conflito de reserva arbitrado.', { projectId: telemetry.projectId, requestingAgvId: telemetry.agv.id, requestingMissionId: telemetry.agv.missionId, conflictingAgvId: String(conflictingAgv._id), conflictingMissionId: error.conflictingMissionId, pointId: error.conflictPointId, requesterMustYield: requesterYields });
          confirmPosition(channel, message, telemetry, false, error.message, !requesterYields, requesterYields);
        } else {
          confirmPosition(channel, message, telemetry, false, error.message, true);
        }
        channel.ack(message);
        return;
      }
      await rpcRequest('sigma.agvs', { method: 'PUT', path: `/api/agvs/${telemetry.agv.id}`, query: {}, body: { location: point.id, battery: telemetry.agv.battery, status: statuses[telemetry.agv.status] || 'Offline' } });
      logger.debug('Posição RFID confirmada.', { projectId: telemetry.projectId, agvId: telemetry.agv.id, missionId: telemetry.agv.missionId, pointId: point.id, rfidTag: telemetry.rfidTag, battery: telemetry.agv.battery });
      confirmPosition(channel, message, telemetry, true);
      channel.sendToQueue('sigma.robot.telemetry', Buffer.from(JSON.stringify(enriched)), {
        contentType: 'application/json',
        persistent: false,
      });
      channel.ack(message);
    } catch (error) {
      console.error('Erro ao encaminhar telemetria:', error);
      retryOrDiscard(channel, 'sigma.robot.telemetry.raw', message, error);
    } finally {
      await session.close();
    }
  });
}

module.exports = { requesterHasPriority, startRobotEventConsumer };
