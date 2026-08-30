const mongoose = require('mongoose');

const routeReservationSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  missionId: { type: String, required: true, index: true },
  agvId: { type: String, required: true },
  edgeKey: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  order: { type: Number, required: true },
  status: { type: String, enum: ['planned', 'reserved', 'released'], default: 'planned' },
  releasedAt: { type: Date, default: null },
}, { timestamps: true });

routeReservationSchema.index(
  { projectId: 1, edgeKey: 1 },
  { unique: true, partialFilterExpression: { status: 'reserved' } }
);

const RouteReservation = mongoose.model('RouteReservation', routeReservationSchema);
module.exports = { RouteReservation };
