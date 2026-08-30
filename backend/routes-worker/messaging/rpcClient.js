const amqp = require('amqplib');
const { randomUUID } = require('crypto');
const { env } = require('../config/env');

let connection;
let channel;
let replyQueue;
const pending = new Map();

async function connectRpcClient() {
  if (channel) return;
  connection = await amqp.connect(env.RABBITMQ_URL);
  connection.on('close', () => { channel = undefined; replyQueue = undefined; });
  channel = await connection.createChannel();
  const asserted = await channel.assertQueue('', { exclusive: true, autoDelete: true });
  replyQueue = asserted.queue;
  await channel.consume(replyQueue, (message) => {
    if (!message) return;
    const callback = pending.get(message.properties.correlationId);
    if (callback) callback(JSON.parse(message.content.toString()));
  }, { noAck: true });
}

async function rpcRequest(queue, request) {
  await connectRpcClient();
  return new Promise((resolve, reject) => {
    const correlationId = randomUUID();
    const timeout = setTimeout(() => {
      pending.delete(correlationId);
      reject(new Error('Tempo de resposta do serviço esgotado.'));
    }, 15000);
    pending.set(correlationId, (response) => {
      clearTimeout(timeout);
      pending.delete(correlationId);
      if (response.status >= 400) reject(Object.assign(new Error(response.body?.message || 'Falha no serviço dependente.'), { status: response.status }));
      else resolve(response.body);
    });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(request)), {
      correlationId,
      replyTo: replyQueue,
      contentType: 'application/json',
    });
  });
}

async function publish(queue, payload) {
  await connectRpcClient();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    contentType: 'application/json',
    persistent: true,
  });
}

module.exports = { connectRpcClient, publish, rpcRequest };
