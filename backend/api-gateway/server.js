const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const amqp = require('amqplib');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET não foi definido.');
const queues = { auth: 'sigma.users', users: 'sigma.users', projects: 'sigma.projects', missions: 'sigma.missions', agvs: 'sigma.agvs', settings: 'sigma.routes' };
let channel;
let replyQueue;
const pending = new Map();
const latestTelemetry = new Map();
const websocketServer = new WebSocketServer({ noServer: true });

async function connectRabbitMQ() {
  while (!channel) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      connection.on('close', () => { channel = undefined; setTimeout(connectRabbitMQ, 2000); });
      connection.on('error', (error) => console.error('RabbitMQ connection error:', error.message));
      channel = await connection.createChannel();
      await Promise.all(Object.values(queues).map((queue) => channel.assertQueue(queue, { durable: true })));
      const asserted = await channel.assertQueue('', { exclusive: true, autoDelete: true });
      replyQueue = asserted.queue;
      await channel.consume(replyQueue, (message) => {
        if (!message) return;
        const callback = pending.get(message.properties.correlationId);
        if (callback) callback(JSON.parse(message.content.toString()));
      }, { noAck: true });
      await channel.assertQueue('sigma.robot.telemetry', { durable: true });
      await channel.consume('sigma.robot.telemetry', (message) => {
        if (!message) return;
        try {
          const telemetry = JSON.parse(message.content.toString());
          if (telemetry.agv?.id) latestTelemetry.set(telemetry.agv.id, telemetry);
          const payload = JSON.stringify(telemetry);
          for (const client of websocketServer.clients) {
            if (client.readyState === WebSocket.OPEN) client.send(payload);
          }
          channel.ack(message);
        } catch (error) {
          console.error('Telemetria inválida:', error.message);
          channel.nack(message, false, false);
        }
      });
      console.log('Gateway conectado ao RabbitMQ');
    } catch (error) {
      console.error('Aguardando o RabbitMQ:', error.message);
      channel = undefined;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

function rpcRequest(queue, payload) {
  return new Promise((resolve, reject) => {
    if (!channel || !replyQueue) return reject(new Error('RabbitMQ indisponível'));
    const correlationId = randomUUID();
    const timeout = setTimeout(() => { pending.delete(correlationId); reject(new Error('Tempo de resposta do serviço esgotado')); }, 30000);
    pending.set(correlationId, (response) => { clearTimeout(timeout); pending.delete(correlationId); resolve(response); });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { correlationId, replyTo: replyQueue, contentType: 'application/json', persistent: true });
  });
}

const app = express();
app.use(helmet());
app.use(express.json({ limit: '15mb' }));
// Protege apenas a autenticação contra força bruta. Aplicar o mesmo limite a
// todas as APIs fazia polling e recargas bloquearem o sistema inteiro para um IP.
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' },
}));
app.get('/health', (_req, res) => res.status(channel ? 200 : 503).json({ status: channel ? 'ok' : 'degraded', rabbitmq: Boolean(channel) }));
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Autenticação obrigatória.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const resource = req.path.split('/').filter(Boolean)[0];
    const writeRoles = {
      agvs: ['admin', 'maintenance'],
      missions: ['admin', 'operator'],
      projects: ['admin', 'designer'],
      users: ['admin'],
      settings: ['admin'],
      routes: ['admin'],
    };
    const allowedRoles = writeRoles[resource];
    const requiresPermission = req.method !== 'GET' || resource === 'users' || resource === 'settings';
    if (requiresPermission && (!allowedRoles || !allowedRoles.includes(req.user.role))) {
      return res.status(403).json({ message: 'Seu perfil não possui permissão para executar esta operação.' });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }
});
app.use('/api', async (req, res) => {
  const service = req.path.split('/').filter(Boolean)[0];
  const queue = queues[service];
  if (!queue) return res.status(404).json({ message: 'Serviço desconhecido.' });
  try {
    const response = await rpcRequest(queue, { method: req.method, path: `/api${req.path}`, query: req.query, headers: { authorization: req.headers.authorization }, body: req.body });
    if (response.contentType) res.type(response.contentType);
    return res.status(response.status).send(response.body);
  } catch (error) {
    return res.status(error.message.includes('esgotado') ? 504 : 503).json({ message: error.message });
  }
});

const server = http.createServer(app);
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws/agvs') return socket.destroy();
  try {
    jwt.verify(url.searchParams.get('token') || '', JWT_SECRET);
    websocketServer.handleUpgrade(request, socket, head, (client) => websocketServer.emit('connection', client));
  } catch (_error) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});
websocketServer.on('connection', (client) => {
  client.isAlive = true;
  client.on('pong', () => { client.isAlive = true; });
  client.send(JSON.stringify({ type: 'AGV_SNAPSHOT', items: [...latestTelemetry.values()] }));
});

// Detecta clientes desconectados sem depender de uma nova telemetria. Os pings
// também impedem que proxies encerrem silenciosamente uma conexão ociosa.
const websocketHeartbeat = setInterval(() => {
  for (const client of websocketServer.clients) {
    if (!client.isAlive) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30000);
websocketHeartbeat.unref();

server.listen(PORT, () => { console.log(`Gateway em execução na porta ${PORT}`); connectRabbitMQ(); });
