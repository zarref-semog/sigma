const neo4j = require('neo4j-driver');
const { env } = require('./env');

const driver = neo4j.driver(
  env.NEO4J_URI,
  neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD)
);

module.exports = { driver };
