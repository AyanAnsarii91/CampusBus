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
      shift: req.body?.shift || "morning",
    });
    bus.status = "active";
    bus.currentLocation = undefined;
    bus.lastUpdated = new Date();
    await bus.save();
    req.app
      ?.get("io")
      ?.to(`bus:${bus._id}`)
      .emit("trip:started", {
        tripId: trip._id,
        busId: bus._id,
        shift: trip.shift,
        startedAt: trip.startedAt,
      });
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
    await Bus.findByIdAndUpdate(trip.busId, {
      $set: { status: "offline" },
      $unset: { currentLocation: 1, lastUpdated: 1 },
    });
    req.app
      ?.get("io")
      ?.to(`bus:${trip.busId}`)
      .emit("trip:ended", {
        tripId: trip._id,
        busId: trip.busId,
        status: "ended",
        shift: trip.shift,
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        stopArrivals: trip.stopArrivals || [],
      });
    res.json({ trip });
  } catch (e) {
    next(e);
  }
});
export default r;
