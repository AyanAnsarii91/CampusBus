import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";
import { clearSpeedCache } from "../services/location.js";
export async function start(req, res, next) {
  try {
    if (req.user?.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can start trips." });
    }
    const driverId = req.user.id;
    const bus = await Bus.findOne({ driverId });
    if (!bus) {
      return res.status(409).json({
        message:
          "No bus is assigned to your driver account. Contact an administrator.",
      });
    }
    if (!bus.routeId)
      return res.status(409).json({
        message:
          "Your assigned bus does not have a route configured. Contact an administrator.",
      });
    const active = await Trip.findOne({ busId: bus._id, status: "active" });
    if (active)
      return res
        .status(409)
        .json({ message: "Bus already has an active trip" });
    const trip = await Trip.create({
      busId: bus._id,
      driverId,
      routeId: bus.routeId,
    });
    bus.status = "active";
    await bus.save();
    req.app
      .get("io")
      ?.to(`bus:${bus._id}`)
      .emit("trip:started", { tripId: trip._id, busId: bus._id });
    res.status(201).json({ trip });
  } catch (e) {
    next(e);
  }
}
export async function stop(req, res, next) {
  try {
    const trip = await Trip.findOne({
      _id: req.body.tripId,
      driverId: req.user._id,
      status: "active",
    });
    if (!trip)
      return res.status(404).json({ message: "Active trip not found" });
    trip.status = "ended";
    trip.endedAt = new Date();
    await trip.save();
    await Bus.findByIdAndUpdate(trip.busId, { status: "offline" });
    req.app
      .get("io")
      ?.to(`bus:${trip.busId}`)
      .emit("trip:ended", { tripId: trip._id, busId: trip.busId });
    clearSpeedCache(String(trip.busId));
    res.json({ trip });
  } catch (e) {
    next(e);
  }
}
export async function active(req, res, next) {
  try {
    const trips = await Trip.find({ status: "active" })
      .populate("busId", "busNumber currentLocation status lastUpdated")
      .populate("routeId", "name")
      .populate("driverId", "name");
    res.json({ trips });
  } catch (e) {
    next(e);
  }
}
export async function get(req, res, next) {
  try {
    const trip = await Trip.findById(req.params.id).populate(
      "busId routeId driverId",
    );
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    res.json({ trip });
  } catch (e) {
    next(e);
  }
}
