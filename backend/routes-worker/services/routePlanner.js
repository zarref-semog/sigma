const { driver } = require('../config/graphDb');
const { RouteReservation } = require('../models/routeReservation');
const { PointReservation } = require('../models/pointReservation');
const { publish, rpcRequest } = require('../messaging/rpcClient');
const { buildGraph, edgeKey, shortestPath } = require('./pathfinder');
const { getSettings } = require('./settings');
const logger = require('../utils/logger');
const chargingRetries = new Map();

function internalRequest(method, path, body) {
  const resource = path.split('/').filter(Boolean)[1];
  const queue = resource === 'agvs' ? 'sigma.agvs' : 'sigma.missions';
  return rpcRequest(queue, { method, path, query: {}, body });
}

async function loadGraph(projectId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (point:InterestPoint {projectId: $projectId})
       OPTIONAL MATCH (point)-[route:ROUTE]-(target:InterestPoint {projectId: $projectId})
       RETURN collect(DISTINCT point {.*}) AS points,
              collect(DISTINCT CASE WHEN route IS NULL THEN null ELSE {id: route.id, from: startNode(route).id, to: endNode(route).id} END) AS routes`,
      { projectId }
    );
    if (!result.records.length) return { points: [], routes: [] };
    const raw = result.records[0];
    const points = raw.get('points').map((point) => ({ ...point, x: Number(point.x), y: Number(point.y) }));
    const routes = raw.get('routes').filter(Boolean);
    return { points, routes };
  } finally {
    await session.close();
  }
}

function resolvePoint(points, reference) {
  const normalized = String(reference || '').trim().toLowerCase();
  return points.find((point) => [point.id, point.rfidTag, point.name].some((value) => String(value || '').trim().toLowerCase() === normalized));
}

function routeEdges(nodes) {
  const seen = new Set();
  return nodes.slice(0, -1).map((from, index) => ({
    from,
    to: nodes[index + 1],
    edgeKey: edgeKey(from, nodes[index + 1]),
    order: index,
  })).filter((edge) => {
    if (seen.has(edge.edgeKey)) return false;
    seen.add(edge.edgeKey);
    return true;
  });
}

function findDirection(from, to) {
  for (const direction of ['north', 'east', 'south', 'west']) {
    if (from[direction] === to.id) return direction;
  }
  const dx = Number(to.x) - Number(from.x);
  const dy = Number(to.y) - Number(from.y);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north');
}

function buildInstructions(nodes, points) {
  const headings = { north: 0, east: 90, south: 180, west: 270 };
  const byId = new Map(points.map((point) => [point.id, point]));
  let heading = 'north';
  const instructions = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const from = byId.get(nodes[index]);
    const to = byId.get(nodes[index + 1]);
    const direction = findDirection(from, to);
    let turn = (headings[direction] - headings[heading] + 360) % 360;
    if (turn > 180) turn -= 360;
    if (turn) instructions.push({ type: 'TURN', degrees: turn, text: `Gire ${Math.abs(turn)} graus para a ${turn > 0 ? 'direita' : 'esquerda'}.` });
    instructions.push({ type: 'MOVE', from: from.id, to: to.id, direction, target: { id: to.id, name: to.name, rfidTag: to.rfidTag }, text: `Siga até ${to.name}.` });
    heading = direction;
  }
  return instructions;
}

async function reserve(projectId, missionId, agvId, edges, nodes) {
  try {
    if (edges.length) await RouteReservation.insertMany(edges.map((edge) => ({
      projectId, missionId, agvId, ...edge, status: edge.order === 0 ? 'reserved' : 'planned',
    })), { ordered: true });
    await PointReservation.insertMany(nodes.map((pointId, order) => ({
      projectId, missionId, agvId, pointId, order, status: order <= 1 ? 'reserved' : 'planned',
    })), { ordered: true });
  } catch (error) {
    await RouteReservation.deleteMany({ projectId, missionId });
    await PointReservation.deleteMany({ projectId, missionId });
    if (error.code === 11000) throw Object.assign(new Error('Um dos trechos ou pontos acabou de ser reservado por outro AGV.'), { collision: true });
    throw error;
  }
}

async function assignOnce({ missionId, projectId }) {
  const [mission, agvs, graphData, reservations, pointReservations, settings] = await Promise.all([
    internalRequest('GET', `/api/missions/${missionId}`),
    internalRequest('GET', '/api/agvs'),
    loadGraph(projectId),
    RouteReservation.find({ projectId, status: 'reserved' }).lean(),
    PointReservation.find({ projectId, status: 'reserved' }).lean(),
    getSettings(),
  ]);
  const source = resolvePoint(graphData.points, mission.source);
  const destination = resolvePoint(graphData.points, mission.destination);
  if (mission.status !== 'Pending') {
    throw Object.assign(new Error('Apenas missões pendentes podem receber uma rota.'), { status: 409 });
  }
  if (!source || !destination) throw Object.assign(new Error('A origem ou o destino da missão não existe no grafo do projeto.'), { status: 422 });

  const blocked = new Set(reservations.map((item) => item.edgeKey));
  const reservedPoints = new Set(pointReservations.map((item) => item.pointId));
  // AGVs disponíveis podem ser deslocados sob demanda quando estiverem parados
  // em um corredor. AGVs em movimento, carga ou offline continuam bloqueados.
  const occupiedByAgv = new Set(agvs.filter((agv) => agv.location && agv.status !== 'Available').map((agv) => String(agv.location)));
  const graph = buildGraph(graphData.points, graphData.routes);
  const candidates = agvs
    .filter((agv) => String(agv.projectId || '') === String(projectId) && ['Available', 'Charging'].includes(agv.status) && Number(agv.battery) >= settings.minimumBattery && !agv.currentMission)
    .map((agv) => {
      const location = resolvePoint(graphData.points, agv.location) || source;
      const blockedPoints = new Set([...reservedPoints, ...occupiedByAgv]);
      blockedPoints.delete(location.id);
      const pickupPath = shortestPath(graph, location.id, source.id, blocked, blockedPoints);
      if (!pickupPath) return null;
      for (const node of pickupPath.nodes) blockedPoints.delete(node);
      const deliveryPath = shortestPath(graph, source.id, destination.id, blocked, blockedPoints);
      if (!pickupPath || !deliveryPath) return null;
      const nodes = [...pickupPath.nodes, ...deliveryPath.nodes.slice(1)];
      return { agv, nodes, distance: pickupPath.distance + deliveryPath.distance };
    })
    .filter(Boolean)
    .sort((left, right) => Number(right.agv.status === 'Available') - Number(left.agv.status === 'Available') || left.distance - right.distance || right.agv.battery - left.agv.battery);

  if (!candidates.length) throw Object.assign(new Error('Nenhum AGV disponível possui uma rota livre até o destino.'), { status: 409 });
  logger.debug('Candidatos calculados para a missão.', { missionId, projectId, candidates: candidates.map(({ agv, distance }) => ({ agvId: String(agv._id), status: agv.status, battery: agv.battery, distance })) });
  let selected;
  let edges;
  let collision;
  for (const candidate of candidates) {
    try {
      const candidateEdges = routeEdges(candidate.nodes);
      await reserve(projectId, missionId, String(candidate.agv._id), candidateEdges, [...new Set(candidate.nodes)]);
      selected = candidate;
      edges = candidateEdges;
      break;
    } catch (error) {
      if (!error.collision) throw error;
      collision = error;
    }
  }
  if (!selected) throw collision || Object.assign(new Error('Nenhum AGV pôde reservar uma rota livre.'), { status: 409, collision: true });

  try {
    await internalRequest('PUT', `/api/agvs/${selected.agv._id}`, { status: 'Executing Mission', currentMission: missionId });
    await internalRequest('PUT', `/api/missions/${missionId}`, { status: 'In Progress', agv: String(selected.agv._id) });
    await publish('sigma.robot.commands', {
      type: 'EXECUTE_ROUTE',
      missionId,
      projectId,
      agv: { id: String(selected.agv._id), name: selected.agv.name, battery: selected.agv.battery },
      initialPosition: ((point) => ({ id: point.id, name: point.name, rfidTag: point.rfidTag }))(graphData.points.find((point) => point.id === selected.nodes[0])),
      instructions: buildInstructions(selected.nodes, graphData.points),
      stepIntervalMs: settings.robotStepIntervalMs,
    });
    logger.info('Rota reservada e comando enviado ao robô.', { missionId, projectId, agvId: String(selected.agv._id), agvName: selected.agv.name, distance: Math.round(selected.distance * 100) / 100, points: selected.nodes.length, routes: edges.length });
  } catch (error) {
    await RouteReservation.deleteMany({ projectId, missionId });
    await PointReservation.deleteMany({ projectId, missionId });
    await internalRequest('PUT', `/api/agvs/${selected.agv._id}`, { status: selected.agv.status, currentMission: selected.agv.currentMission || null }).catch(() => undefined);
    await internalRequest('PUT', `/api/missions/${missionId}`, { status: mission.status, agv: mission.agv || null }).catch(() => undefined);
    logger.error('A atribuição foi revertida após falha no despacho.', { missionId, projectId, agvId: String(selected.agv._id), error });
    throw error;
  }

  return {
    missionId,
    projectId,
    agv: { id: String(selected.agv._id), name: selected.agv.name, battery: selected.agv.battery },
    path: selected.nodes,
    distance: Math.round(selected.distance * 100) / 100,
    reservedRoutes: edges.map(({ edgeKey: key, from, to, order }) => ({ key, from, to, order })),
  };
}

async function assignMission(input) {
  if (!input.missionId) throw Object.assign(new Error('missionId é obrigatório.'), { status: 400 });
  if (!input.projectId) {
    const mission = await internalRequest('GET', `/api/missions/${input.missionId}`);
    input = { ...input, projectId: mission.projectId };
  }
  if (!input.projectId) throw Object.assign(new Error('A missão não possui um projeto associado.'), { status: 400 });
  const existing = await RouteReservation.findOne({ missionId: input.missionId, status: 'reserved' });
  if (existing) throw Object.assign(new Error('Esta missão já possui uma rota reservada.'), { status: 409 });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await assignOnce(input); } catch (error) {
      if (!error.collision || attempt === 2) throw error;
    }
  }
  throw Object.assign(new Error('Não foi possível reservar uma rota sem colisões.'), { status: 409 });
}

async function releaseMission(missionId) {
  const [reservations, pointReservations] = await Promise.all([
    RouteReservation.find({ missionId, status: { $in: ['reserved', 'planned'] } }).lean(),
    PointReservation.find({ missionId, status: { $in: ['reserved', 'planned'] } }).lean(),
  ]);
  const agvId = reservations[0]?.agvId || pointReservations[0]?.agvId;
  if (!agvId) throw Object.assign(new Error('Nenhuma reserva ativa foi encontrada para a missão.'), { status: 404 });
  await RouteReservation.updateMany({ missionId, status: { $in: ['reserved', 'planned'] } }, { status: 'released', releasedAt: new Date() });
  await PointReservation.updateMany({ missionId, status: { $in: ['reserved', 'planned'] } }, { status: 'released', releasedAt: new Date() });
  await internalRequest('PUT', `/api/agvs/${agvId}`, { status: 'Available', currentMission: null });
  logger.info('Reservas da missão liberadas.', { missionId, agvId, releasedRoutes: reservations.length, releasedPoints: pointReservations.length });
  return { message: 'Rota liberada com sucesso.', missionId, releasedRoutes: reservations.length, releasedPoints: pointReservations.length };
}

async function advanceReservations(missionId, pointId) {
  if (!missionId || !pointId) return;
  const currentPoint = await PointReservation.findOne({ missionId, pointId, status: 'reserved' }).lean();
  if (!currentPoint) return;
  let pointAdvanced = false;
  const [nextPoint, nextRoute] = await Promise.all([
    PointReservation.findOne({ missionId, status: 'planned', order: currentPoint.order + 1 }).lean(),
    RouteReservation.findOne({ missionId, status: 'planned', order: currentPoint.order }).lean(),
  ]);
  try {
    const pointResult = await PointReservation.updateOne(
      { missionId, status: 'planned', order: currentPoint.order + 1 },
      { status: 'reserved' },
    );
    pointAdvanced = pointResult.modifiedCount > 0;
    await RouteReservation.updateOne(
      { missionId, status: 'planned', order: currentPoint.order },
      { status: 'reserved' },
    );
  } catch (error) {
    if (pointAdvanced) {
      await PointReservation.updateOne(
        { missionId, status: 'reserved', order: currentPoint.order + 1 },
        { status: 'planned' },
      );
    }
    if (error.code === 11000) {
      const [pointConflict, routeConflict] = await Promise.all([
        nextPoint ? PointReservation.findOne({ missionId: { $ne: missionId }, projectId: currentPoint.projectId, pointId: nextPoint.pointId, status: 'reserved' }).lean() : null,
        nextRoute ? RouteReservation.findOne({ missionId: { $ne: missionId }, projectId: currentPoint.projectId, edgeKey: nextRoute.edgeKey, status: 'reserved' }).lean() : null,
      ]);
      const conflict = pointConflict || routeConflict;
      throw Object.assign(new Error('O próximo trecho ainda está ocupado.'), {
        collision: true,
        conflictingMissionId: conflict?.missionId,
        conflictingAgvId: conflict?.agvId,
        conflictPointId: nextPoint?.pointId || nextRoute?.to,
      });
    }
    throw error;
  }
  const releasedAt = new Date();
  await RouteReservation.updateMany({ missionId, status: 'reserved', order: { $lt: currentPoint.order } }, { status: 'released', releasedAt });
  await PointReservation.updateMany({ missionId, status: 'reserved', order: { $lt: currentPoint.order } }, { status: 'released', releasedAt });
}

async function normalizeReservationWindows() {
  const missionIds = await RouteReservation.distinct('missionId', { status: 'reserved' });
  if (!missionIds.length) return;
  const agvs = await internalRequest('GET', '/api/agvs');
  for (const missionId of missionIds) {
    const points = await PointReservation.find({ missionId, status: { $ne: 'released' } }).sort({ order: 1 }).lean();
    if (!points.length) continue;
    const agv = agvs.find((item) => String(item.currentMission) === String(missionId));
    const current = points.find((point) => String(point.pointId) === String(agv?.location)) || points[0];
    await Promise.all([
      RouteReservation.updateMany({ missionId, status: 'reserved' }, { status: 'planned' }),
      PointReservation.updateMany({ missionId, status: 'reserved' }, { status: 'planned' }),
    ]);
    await PointReservation.updateOne({ missionId, order: current.order }, { status: 'reserved' });
    await PointReservation.updateOne({ missionId, order: current.order + 1 }, { status: 'reserved' }).catch(() => undefined);
    await RouteReservation.updateOne({ missionId, order: current.order }, { status: 'reserved' }).catch(() => undefined);
  }
}

async function completeMission(event) {
  const mission = await internalRequest('GET', `/api/missions/${event.missionId}`);
  const result = await releaseMission(event.missionId).catch((error) => {
    if (error.status === 404) return { message: 'A rota da missão já estava liberada.' };
    throw error;
  });
  if (mission.status !== 'Completed') {
    await internalRequest('PUT', `/api/missions/${event.missionId}`, { status: 'Completed' });
    await publish('sigma.robot.telemetry', { type: 'MISSION_COMPLETED', projectId: event.projectId, missionId: event.missionId, completedAt: new Date().toISOString() });
  }
  logger.info('Missão concluída.', { missionId: event.missionId, projectId: event.projectId, agvId: event.agvId, battery: event.battery, finalPointId: event.finalPoint?.id });
  await internalRequest('PUT', `/api/agvs/${event.agvId}`, { battery: event.battery, location: event.finalPoint.id });
  await scheduleChargingReturn(event);
  return result;
}

async function scheduleChargingReturn(event) {
  const [settings, missions] = await Promise.all([getSettings(), internalRequest('GET', '/api/missions')]);
  const hasPending = missions.some((mission) => mission.status === 'Pending' && String(mission.projectId) === String(event.projectId));
  if (Number(event.battery) > settings.minimumBattery && hasPending) return;
  try {
    await dispatchToCharging(event);
    chargingRetries.delete(String(event.agvId));
  } catch (error) {
    logger.warn('Retorno à carga será tentado novamente.', { agvId: event.agvId, missionId: event.missionId, reason: error.message });
    const agvId = String(event.agvId);
    clearTimeout(chargingRetries.get(agvId));
    const timer = setTimeout(() => scheduleChargingReturn(event), settings.schedulerIntervalSeconds * 1000);
    timer.unref();
    chargingRetries.set(agvId, timer);
  }
}

async function reconcileIdleAgvsToCharging() {
  const agvs = await internalRequest('GET', '/api/agvs');
  const idle = agvs.filter((agv) => agv.status === 'Available' && !agv.currentMission && agv.location);
  await Promise.allSettled(idle.map((agv) => scheduleChargingReturn({
    missionId: `idle:${agv._id}`,
    projectId: agv.projectId,
    agvId: String(agv._id),
    agvName: agv.name,
    finalPoint: { id: agv.location },
    battery: agv.battery,
  })));
}

async function reconcileFinishedMissionAgvs() {
  const [agvs, missions] = await Promise.all([
    internalRequest('GET', '/api/agvs'),
    internalRequest('GET', '/api/missions'),
  ]);
  const missionById = new Map(missions.map((mission) => [String(mission._id), mission]));
  const stale = agvs.filter((agv) => {
    if (!agv.currentMission || String(agv.currentMission).startsWith('charge:')) return false;
    return ['Completed', 'Failed'].includes(missionById.get(String(agv.currentMission))?.status);
  });
  await Promise.all(stale.map(async (agv) => {
    await releaseMission(String(agv.currentMission)).catch(async (error) => {
      if (error.status !== 404) throw error;
      await internalRequest('PUT', `/api/agvs/${agv._id}`, { status: 'Available', currentMission: null });
    });
    logger.warn('Estado residual de missão finalizada foi reconciliado.', { agvId: String(agv._id), missionId: String(agv.currentMission) });
  }));
}

async function dispatchToCharging(event) {
  const settings = await getSettings();
  if (!settings.automaticReturnToCharge) return;
  const reservationId = `charge:${event.missionId}`;
  if (await RouteReservation.exists({ missionId: reservationId, status: 'reserved' })) return;
  const graphData = await loadGraph(event.projectId);
  const start = resolvePoint(graphData.points, event.finalPoint.id);
  const chargingPoints = graphData.points.filter((point) => point.type === 'charging');
  if (!start || !chargingPoints.length) throw new Error('O projeto não possui uma zona de carregamento acessível.');
  if (start.type === 'charging') {
    await internalRequest('PUT', `/api/agvs/${event.agvId}`, { status: 'Charging', currentMission: null, location: start.id, battery: event.battery });
    logger.info('AGV já se encontra em uma zona de carregamento.', { agvId: event.agvId, pointId: start.id, battery: event.battery });
    return;
  }
  const [blockedItems, blockedPointItems, agvs] = await Promise.all([
    RouteReservation.find({ projectId: event.projectId, status: 'reserved' }).lean(),
    PointReservation.find({ projectId: event.projectId, status: 'reserved' }).lean(),
    internalRequest('GET', '/api/agvs'),
  ]);
  const blocked = new Set(blockedItems.map((item) => item.edgeKey));
  const blockedPoints = new Set([
    ...blockedPointItems.map((item) => item.pointId),
    ...agvs.filter((agv) => String(agv._id) !== String(event.agvId) && agv.location && agv.status !== 'Available').map((agv) => String(agv.location)),
  ]);
  blockedPoints.delete(start.id);
  const graph = buildGraph(graphData.points, graphData.routes);
  const alternatives = chargingPoints.map((point) => ({ point, route: shortestPath(graph, start.id, point.id, blocked, blockedPoints) })).filter((item) => item.route).sort((left, right) => left.route.distance - right.route.distance);
  if (!alternatives.length) throw new Error('Nenhuma rota livre até uma zona de carregamento.');
  const selected = alternatives[0];
  await reserve(event.projectId, reservationId, event.agvId, routeEdges(selected.route.nodes), [...new Set(selected.route.nodes)]);
  await internalRequest('PUT', `/api/agvs/${event.agvId}`, { status: 'Executing Mission', currentMission: reservationId });
  await publish('sigma.robot.commands', {
    type: 'RETURN_TO_CHARGE',
    missionId: reservationId,
    originalMissionId: event.missionId,
    projectId: event.projectId,
    agv: { id: event.agvId, name: event.agvName || event.agvId, battery: event.battery },
    initialPosition: { id: start.id, name: start.name, rfidTag: start.rfidTag },
    instructions: buildInstructions(selected.route.nodes, graphData.points),
    stepIntervalMs: settings.robotStepIntervalMs,
  });
  logger.info('Retorno para carregamento despachado.', { agvId: event.agvId, projectId: event.projectId, reservationId, chargingPointId: selected.point.id, pathPoints: selected.route.nodes.length });
}

async function finishChargingReturn(event) {
  await RouteReservation.updateMany({ missionId: event.missionId, status: { $in: ['reserved', 'planned'] } }, { status: 'released', releasedAt: new Date() });
  await PointReservation.updateMany({ missionId: event.missionId, status: { $in: ['reserved', 'planned'] } }, { status: 'released', releasedAt: new Date() });
  await internalRequest('PUT', `/api/agvs/${event.agvId}`, { status: 'Charging', currentMission: null, battery: event.battery, location: event.finalPoint.id });
  logger.info('AGV chegou à zona de carregamento.', { agvId: event.agvId, pointId: event.finalPoint.id, battery: event.battery });
}

async function failMission(event) {
  await releaseMission(event.missionId).catch(() => undefined);
  if (String(event.missionId).startsWith('charge:')) return;
  await internalRequest('PUT', `/api/missions/${event.missionId}`, { status: 'Failed' });
  logger.error('Execução da missão falhou.', { missionId: event.missionId, projectId: event.projectId, agvId: event.agvId, reason: event.reason });
}

async function yieldMission(event) {
  await releaseMission(event.missionId).catch(() => undefined);
  await internalRequest('PUT', `/api/agvs/${event.agvId}`, { status: 'Available', currentMission: null });
  if (String(event.missionId).startsWith('charge:')) {
    logger.warn('Retorno à carga cedeu passagem para uma missão.', { missionId: event.missionId, projectId: event.projectId, agvId: event.agvId, retreatPointId: event.finalPoint?.id });
    return;
  }
  await internalRequest('PUT', `/api/missions/${event.missionId}`, { status: 'Pending', agv: null });
  logger.warn('AGV recuou e a missão voltou para a fila.', { missionId: event.missionId, projectId: event.projectId, agvId: event.agvId, retreatPointId: event.finalPoint?.id });
}

module.exports = { advanceReservations, assignMission, completeMission, dispatchToCharging, failMission, finishChargingReturn, normalizeReservationWindows, reconcileFinishedMissionAgvs, reconcileIdleAgvsToCharging, releaseMission, yieldMission };
