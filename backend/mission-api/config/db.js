const mongoose = require('mongoose');
const { env } = require('./env');

mongoose.Promise = global.Promise;

const db = {
    mongoose: mongoose,
    url: env.DATABASE_URL,
}

module.exports = db;