const amqp = require('amqplib');
const http = require('http');
const { randomUUID } = require('crypto');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672';
const PORT = Number(process.env.PORT || 3006);
const STEP_INTERVAL = Number(process.env.ROBOT_STEP_INTERVAL_MS || 250);
const activeRobots = new Set();
const pendingPositions = new Map();
const yieldRequests = new Map();
let connected = false;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function send(channel, queue, payload) {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { contentType: 'application/json', persistent: true });
}

function waitForPositionConfirmation(channel, replyQueue, payload, retryInterval, takeYield) {
  const yieldRequest = takeYield?.();
  if (yieldRequest) {
    const error = new Error(yieldRequest.reason || 'Rota cedida para outra missão.');
    error.yielded = true;
    error.retreatPoint = yieldRequest.retreatPoint;
    return Promise.reject(error);
  }
  return new Promise((resolve, reject) => {
    const movementId = randomUUID();
    const timeout = setTimeout(() => {
      pendingPositions.delete(movementId);
      reject(new Error('Tempo de confirmação da posição esgotado.'));
    }, 30000);
    pendingPositions.set(movementId, (response) => {
      clearTimeout(timeout);
      pendingPositions.delete(movementId);
      resolve(response);
    });
    channel.sendToQueue('sigma.robot.telemetry.raw', Buffer.from(JSON.stringify({ ...payload, movementId })), {
      contentType: 'application/json', persistent: true, replyTo: replyQueue, expiration: '30000',
    });
  }).then(async (response) => {
    if (response.accepted) return;
    if (response.yield) {
      const error = new Error(response.reason || 'Rota cedida para outra missão.');
      error.yielded = true;
      throw error;
    }
    if (!response.retryable) throw new Error(response.reason || 'A posição do AGV foi rejeitada.');
    await wait(retryInterval);
    return waitForPositionConfirmation(channel, replyQueue, payload, retryInterval, takeYield);
  });
}

async function execute(channel, replyQueue, command) {
  const { agv, missionId, projectId, instructions } = command;
  const stepInterval = Number(command.stepIntervalMs || STEP_INTERVAL);
  let heading = 'north';
  let battery = Number(agv.battery);
  let finalPoint = command.initialPosition;
  const takeYield = () => {
    const request = yieldRequests.get(String(agv.id));
    if (request) yieldRequests.delete(String(agv.id));
    return request;
  };
  const stopIfYieldRequested = () => {
    const request = takeYield();
    if (!request) return;
    const error = new Error(request.reason || 'Rota cedida para outra missão.');
    error.yielded = true;
    error.retreatPoint = request.retreatPoint;
    throw error;
  };
  const detectedRfid = (point, instruction, status = 'Executando missão') => waitForPositionConfirmation(channel, replyQueue, {
    type: 'AGV_TELEMETRY', projectId, timestamp: new Date().toISOString(),
    rfidTag: point.rfidTag,
    agv: { id: agv.id, name: agv.name, heading, battery: Math.max(0, Math.round(battery)), status, missionId, instruction },
  }, stepInterval * 2, takeYield);

  await detectedRfid(command.initialPosition, 'Rota recebida.');
  for (const instruction of instructions) {
    stopIfYieldRequested();
    if (instruction.type === 'TURN') {
      await wait(stepInterval * 2);
      continue;
    }
    finalPoint = instruction.target;
    heading = instruction.direction;
    await wait(stepInterval * 10);
    battery -= 0.8;
    await detectedRfid(instruction.target, `RFID ${instruction.target.rfidTag} detectado em ${instruction.target.name}.`);
  }
  const returningToCharge = command.type === 'RETURN_TO_CHARGE';
  await detectedRfid(finalPoint, returningToCharge ? 'Zona de carregamento alcançada.' : 'Destino da missão alcançado.', returningToCharge ? 'Em carga' : 'Executando missão');
  return { type: returningToCharge ? 'CHARGING_ZONE_REACHED' : 'ROUTE_COMPLETED', missionId, projectId, agvId: agv.id, agvName: agv.name, finalPoint, battery: Math.round(battery) };
}

async function connect() {
  while (true) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();
      await Promise.all(['sigma.robot.commands', 'sigma.robot.telemetry.raw', 'sigma.robot.events'].map((queue) => channel.assertQueue(queue, { durable: true })));
      const positionReplies = await channel.assertQueue('', { exclusive: true, autoDelete: true });
      await channel.consume(positionReplies.queue, (message) => {
        if (!message) return;
        try {
          const response = JSON.parse(message.content.toString());
          pendingPositions.get(response.movementId)?.(response);
        } finally {
          channel.ack(message);
        }
      });
      channel.prefetch(10);
      connected = true;
      connection.on('close', () => { connected = false; setTimeout(connect, 2000); });
      await channel.consume('sigma.robot.commands', async (message) => {
        if (!message) return;
        const command = JSON.parse(message.content.toString());
        if (command.type === 'YIELD_ROUTE') {
          yieldRequests.set(String(command.agvId), command);
          channel.ack(message);
          return;
        }
        if (activeRobots.has(command.agv.id)) {
          send(channel, 'sigma.robot.events', { type: 'ROUTE_FAILED', missionId: command.missionId, agvId: command.agv.id, message: 'O AGV já está executando outro roteiro.' });
          channel.nack(message, false, false);
          return;
        }
        activeRobots.add(command.agv.id);
        try {
          const completionEvent = await execute(channel, positionReplies.queue, command);
          activeRobots.delete(command.agv.id);
          send(channel, 'sigma.robot.events', completionEvent);
          channel.ack(message);
        } catch (error) {
          let retreated = false;
          if (error.yielded && error.retreatPoint) {
            try {
              await waitForPositionConfirmation(channel, positionReplies.queue, {
                type: 'AGV_TELEMETRY', projectId: command.projectId, timestamp: new Date().toISOString(),
                rfidTag: error.retreatPoint.rfidTag,
                agv: { id: command.agv.id, name: command.agv.name, battery: command.agv.battery, status: 'Disponível', missionId: command.missionId, instruction: 'Recuo para liberar a rota.' },
              }, Number(command.stepIntervalMs || STEP_INTERVAL) * 2);
              retreated = true;
            } catch (retreatError) {
              error.message += ` Não foi possível recuar: ${retreatError.message}`;
            }
          }
          send(channel, 'sigma.robot.events', { type: error.yielded ? 'ROUTE_YIELDED' : 'ROUTE_FAILED', missionId: command.missionId, agvId: command.agv.id, finalPoint: retreated ? error.retreatPoint : undefined, message: error.message });
          channel.nack(message, false, false);
        } finally {
          activeRobots.delete(command.agv.id);
        }
      });
      console.log('Robot Gateway conectado e aguardando roteiros.');
      return;
    } catch (error) {
      connected = false;
      console.error('Aguardando o RabbitMQ:', error.message);
      await wait(2000);
    }
  }
}

http.createServer((req, res) => {
  if (req.url !== '/health') { res.writeHead(404).end(); return; }
  res.writeHead(connected ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: connected ? 'ok' : 'degraded', activeRobots: activeRobots.size }));
}).listen(PORT, () => console.log(`Robot Gateway em execução na porta ${PORT}`));

connect();
