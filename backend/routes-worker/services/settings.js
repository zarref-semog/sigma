const { env } = require('../config/env');
const { SystemSettings } = require('../models/systemSettings');

const defaults = {
  minimumBattery: env.MIN_BATTERY,
  schedulerIntervalSeconds: Math.max(1, Math.round(env.SCHEDULER_INTERVAL / 1000)),
  robotStepIntervalMs: 250,
  automaticReturnToCharge: true,
};

async function getSettings() {
  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', ...defaults } },
    { returnDocument: 'after', upsert: true, runValidators: true }
  ).lean();
  return settings;
}

async function updateSettings(input) {
  const allowed = Object.fromEntries(['minimumBattery', 'schedulerIntervalSeconds', 'robotStepIntervalMs', 'automaticReturnToCharge'].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  return SystemSettings.findOneAndUpdate({ key: 'global' }, { $set: allowed, $setOnInsert: { key: 'global' } }, { returnDocument: 'after', upsert: true, runValidators: true }).lean();
}

module.exports = { getSettings, updateSettings };
