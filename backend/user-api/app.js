const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const database = require('./config/db');

database.mongoose
.connect(database.url).then(async () => {
    console.log('Conexao estabelecida com sucesso!');
    const { User } = require('./models/user');
    await User.updateMany({ role: { $in: ['user', 'guest'] } }, { $set: { role: 'viewer' } });
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        const exists = await User.exists({ email: process.env.ADMIN_EMAIL.toLowerCase() });
        if (!exists) {
            await User.create({ firstName: 'Administrador', surname: 'SIGMA', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' });
            console.log('Usuário administrador inicial criado.');
        }
    }
}).catch(error => {
    console.log('Erro: ' + error);
    process.exit();
});

const userRouter = require('./routes/user');
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

app.use('/api', requireApiKey, userRouter);

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
