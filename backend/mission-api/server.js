const app = require('./app');

const { env } = require('./config/env');
const { startRpcConsumer } = require('./messaging/rpcConsumer');

const PORT = env.PORT;

app.listen(PORT, () => {
    console.log(`Servidor em execução na porta ${PORT}`);
    startRpcConsumer({ queue: 'sigma.missions', port: PORT });
});
