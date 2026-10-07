import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true, trim: true },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["offline", "active", "stopped", "delayed", "stale"],
      default: "offline",
    },
    currentLocation: {
      latitude: Number,
      longitude: Number,
      speed: Number,
      heading: Number,
      accuracy: Number,
      timestamp: Date,
      lowSpeedSince: Date,
    },
    lastUpdated: Date,
  },
  { timestamps: true },
);
export default mongoose.model("Bus", schema);
