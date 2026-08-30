const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  minimumBattery: { type: Number, min: 0, max: 100, default: 20 },
  schedulerIntervalSeconds: { type: Number, min: 1, max: 300, default: 5 },
  robotStepIntervalMs: { type: Number, min: 50, max: 5000, default: 250 },
  automaticReturnToCharge: { type: Boolean, default: true },
}, { timestamps: true });

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
module.exports = { SystemSettings };
