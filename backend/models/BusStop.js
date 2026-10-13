import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      index: true,
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    sequence: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    scheduledTime: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

export default mongoose.model("BusStop", schema);
