import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  routeNumber: { type: String, trim: true },
  direction: { type: String, trim: true },
  effectiveFrom: { type: String, trim: true },
  busRegistration: { type: String, trim: true },
  driverName: { type: String, trim: true },
  driverMobile: { type: String, trim: true },
  busInCharge: { type: String, trim: true },
  instructions: [{ type: String, trim: true }],
  scheduledStops: [{
    place: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
  }],
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: "BusStop" }],
  createdAt: { type: Date, default: Date.now },
});
export default mongoose.model("Route", schema);
