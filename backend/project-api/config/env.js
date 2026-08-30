const dotenv = require('dotenv');

dotenv.config();

if (!process.env.API_KEY) {
  throw new Error("❌ CRITICAL ERROR: API_KEY is missing in the environment settings!");
}

const env = {
    PORT: parseInt(process.env.PORT ?? 3002),
    API_KEY: process.env.API_KEY,
    DATABASE_URL: process.env.DATABASE_URL ?? 'mongodb://localhost:27017/projects_db',
    NEO4J_URI: process.env.NEO4J_URI ?? 'neo4j://localhost:7687',
    NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD ?? 'password',
    NODE_ENV: process.env.NODE_ENV ?? 'development'
}

module.exports = { env }
