const amqp = require('amqplib');
const { env } = require('../config/env');
const { getSettings, updateSettings } = require('../services/settings');

async function startControlConsumer() {
  const connection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('sigma.routes', { durable: true });
  channel.prefetch(1);
  await channel.consume('sigma.routes', async (message) => {
    if (!message) return;
    let response;
    try {
      const request = JSON.parse(message.content.toString());
      if (request.path !== '/api/settings') {
        response = { status: 404, body: { message: 'Comando desconhecido para o worker de rotas.' } };
      } else if (request.method === 'GET') {
        response = { status: 200, body: await getSettings() };
      } else if (request.method === 'PUT') {
        response = { status: 200, body: await updateSettings(request.body || {}) };
      } else {
        response = { status: 405, body: { message: 'Método não permitido.' } };
      }
    } catch (error) {
      response = { status: 500, body: { message: error.message || 'Erro ao processar o comando.' } };
    }
    if (message.properties.replyTo) {
      channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify({
        ...response,
        contentType: 'application/json',
      })), { correlationId: message.properties.correlationId, contentType: 'application/json' });
    }
    channel.ack(message);
  });
  console.log('Worker consumindo comandos de configuração em sigma.routes.');
}

module.exports = { startControlConsumer };
