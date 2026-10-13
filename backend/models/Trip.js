import mongoose from "mongoose";
const schema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Route",
    required: true,
  },
  shift: { type: String, enum: ["morning", "evening"], default: "morning" },
  status: { type: String, enum: ["active", "ended"], default: "active" },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  stopArrivals: [
    {
      stopId: { type: mongoose.Schema.Types.ObjectId, ref: "BusStop" },
      stopName: { type: String, trim: true },
      arrivedAt: { type: Date, default: Date.now },
      delayMinutes: { type: Number, default: 0 },
    },
  ],
});
export default mongoose.model("Trip", schema);
