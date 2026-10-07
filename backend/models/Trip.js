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
  status: { type: String, enum: ["active", "ended"], default: "active" },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
});
export default mongoose.model("Trip", schema);
