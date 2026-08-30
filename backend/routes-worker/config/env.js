const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/routes_db',
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672',
  NEO4J_URI: process.env.NEO4J_URI || 'neo4j://127.0.0.1:7687',
  NEO4J_USER: process.env.NEO4J_USER || 'neo4j',
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'password',
  MIN_BATTERY: Number(process.env.MIN_AGV_BATTERY || 20),
  SCHEDULER_INTERVAL: Number(process.env.MISSION_SCHEDULER_INTERVAL_MS || 5000),
  CONCURRENCY: Math.max(2, Number(process.env.MISSION_ASSIGNMENT_WORKERS || 4)),
};

module.exports = { env };
