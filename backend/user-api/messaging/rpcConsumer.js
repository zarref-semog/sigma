const amqp = require('amqplib');

async function startRpcConsumer({ queue, port }) {
  const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  while (true) {
    try {
      const connection = await amqp.connect(rabbitUrl);
      connection.on('close', () => setTimeout(() => startRpcConsumer({ queue, port }), 2000));
      connection.on('error', (error) => console.error('RabbitMQ connection error:', error.message));
      const channel = await connection.createChannel();
      await channel.assertQueue(queue, { durable: true });
      channel.prefetch(10);
      await channel.consume(queue, async (message) => {
        if (!message) return;
        try {
          const request = JSON.parse(message.content.toString());
          const query = new URLSearchParams(request.query || {}).toString();
          const headers = { 'content-type': 'application/json', 'x-api-key': process.env.API_KEY || '' };
          if (request.headers?.authorization) headers.authorization = request.headers.authorization;
          const hasBody = !['GET', 'HEAD'].includes(request.method);
          const response = await fetch(`http://127.0.0.1:${port}${request.path}${query ? `?${query}` : ''}`, {
            method: request.method,
            headers,
            body: hasBody ? JSON.stringify(request.body || {}) : undefined,
          });
          const contentType = response.headers.get('content-type') || 'application/json';
          const body = contentType.includes('application/json') ? await response.json() : await response.text();
          channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify({ status: response.status, contentType, body })), {
            correlationId: message.properties.correlationId,
            contentType: 'application/json',
          });
          channel.ack(message);
        } catch (error) {
          console.error(`Falha ao processar mensagem na fila ${queue}:`, error);
          if (message.properties.replyTo) {
            channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify({ status: 500, contentType: 'application/json', body: { message: 'Erro ao processar a requisição no serviço.' } })), { correlationId: message.properties.correlationId });
          }
          channel.nack(message, false, false);
        }
      });
      console.log(`Consumindo a fila RabbitMQ ${queue}`);
      return;
    } catch (error) {
      console.error('Aguardando o RabbitMQ:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

module.exports = { startRpcConsumer };
