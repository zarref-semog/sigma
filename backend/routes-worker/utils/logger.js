const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const minimumLevel = levels[configuredLevel] || levels.info;

function serialize(value) {
  if (value instanceof Error) return { message: value.message, stack: value.stack, code: value.code, status: value.status };
  return value;
}

function write(level, message, context = {}) {
  if (levels[level] < minimumLevel) return;
  const entry = { timestamp: new Date().toISOString(), level, service: 'routes-worker', message };
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) entry[key] = serialize(value);
  }
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

module.exports = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
};
