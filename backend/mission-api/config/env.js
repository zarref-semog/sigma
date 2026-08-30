const dotenv = require('dotenv');

dotenv.config();

if (!process.env.API_KEY) {
  throw new Error("❌ CRITICAL ERROR: API_KEY is missing in the environment settings!");
}

const env = {
    PORT: parseInt(process.env.PORT ?? 3003),
    API_KEY: process.env.API_KEY,
    DATABASE_URL: process.env.DATABASE_URL ?? 'mongodb://localhost:27017/missions_db',
    NODE_ENV: process.env.NODE_ENV ?? 'development'
}

module.exports = { env }
