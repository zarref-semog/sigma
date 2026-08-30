const mongoose = require('mongoose');

const pointReservationSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  missionId: { type: String, required: true, index: true },
  agvId: { type: String, required: true },
  pointId: { type: String, required: true },
  order: { type: Number, required: true },
  status: { type: String, enum: ['planned', 'reserved', 'released'], default: 'planned' },
  releasedAt: { type: Date, default: null },
}, { timestamps: true });

pointReservationSchema.index(
  { projectId: 1, pointId: 1 },
  { unique: true, partialFilterExpression: { status: 'reserved' } }
);

const PointReservation = mongoose.model('PointReservation', pointReservationSchema);
module.exports = { PointReservation };
