const mongoose = require('mongoose');
const { env } = require('./config/env');
const { driver } = require('./config/graphDb');
const { connectRpcClient } = require('./messaging/rpcClient');
const { startControlConsumer } = require('./messaging/controlConsumer');
const { startRobotEventConsumer } = require('./messaging/robotEvents');
const { startMissionScheduler } = require('./messaging/missionScheduler');
const { normalizeReservationWindows } = require('./services/routePlanner');
const logger = require('./utils/logger');

async function start() {
  logger.info('Inicializando worker de rotas.');
  await mongoose.connect(env.DATABASE_URL);
  logger.info('Conexão com MongoDB estabelecida.');
  await driver.verifyConnectivity();
  logger.info('Conexão com Neo4j estabelecida.');
  await connectRpcClient();
  logger.info('Cliente RPC conectado ao RabbitMQ.');
  await normalizeReservationWindows();
  await Promise.all([
    startRobotEventConsumer(),
    startMissionScheduler(),
    startControlConsumer(),
  ]);
  logger.info('Worker de rotas em execução.', { concurrency: env.CONCURRENCY, schedulerIntervalMs: env.SCHEDULER_INTERVAL });
}

start().catch((error) => {
  logger.error('Não foi possível iniciar o worker de rotas.', { error });
  process.exit(1);
});
