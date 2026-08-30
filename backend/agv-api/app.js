const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const database = require('./config/db');

database.mongoose
.connect(database.url).then(() => {
    console.log('Conexao estabelecida com sucesso!');
}).catch(error => {
    console.log('Erro: ' + error);
    process.exit();
});

const agvRouter = require('./routes/agv');
const swaggerSpec = require('./docs/swagger');
const { requireApiKey } = require('./middleware/apiKey');

const app = express();

app.use(helmet());

app.use(cors());

app.use(morgan('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use(compression());

app.use( '/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec) );

app.use('/api', requireApiKey, agvRouter);

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'API em execução.'
    });
});

app.use((req, res) => {
    res.status(404).json({
        message: 'Rota não encontrada.'
    });
});

app.use((error, req, res, next) => {
    console.error(error);

    res.status(error.status || 500).json({
        message: error.message || 'Erro interno do servidor.'
    });
});

module.exports = app;
