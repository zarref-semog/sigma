const { timingSafeEqual } = require('crypto');

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  const received = req.get('x-api-key') || '';
  if (!expected) return res.status(503).json({ message: 'A chave de API do serviço não foi configurada.' });
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return res.status(401).json({ message: 'Chave de API inválida ou ausente.' });
  }
  return next();
}

module.exports = { requireApiKey };
