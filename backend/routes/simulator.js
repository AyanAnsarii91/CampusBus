import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
const r = Router();
r.use(requireAuth, requireRole("admin"));
r.post("/start", async (req, res, next) => {
  try {
    const bus = await Bus.findById(req.body.busId);
    if (!bus || !bus.routeId)
      return res.status(400).json({ message: "Bus and route required" });
    let trip = await Trip.findOne({ busId: bus._id, status: "active" });
    if (trip) return res.json({ trip });
    trip = await Trip.create({
      busId: bus._id,
      driverId: bus.driverId,
      routeId: bus.routeId,
    });
    bus.status = "active";
    await bus.save();
    res.status(201).json({ trip });
  } catch (e) {
    next(e);
  }
});
r.post("/stop", async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.body.tripId, status: "active" });
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    trip.status = "ended";
    trip.endedAt = new Date();
    await trip.save();
    await Bus.findByIdAndUpdate(trip.busId, { status: "offline" });
    res.json({ trip });
  } catch (e) {
    next(e);
  }
});
export default r;
