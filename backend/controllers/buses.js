import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import { assignDriverToBus } from "../services/driverAssignments.js";
export async function list(req, res, next) {
  try {
    const buses = await Bus.find()
      .populate("routeId", "name")
      .populate("driverId", "name email");
    res.json({ buses });
  } catch (e) {
    next(e);
  }
}
export async function get(req, res, next) {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate("routeId")
      .populate("driverId", "name email");
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.json({ bus });
  } catch (e) {
    next(e);
  }
}
export async function create(req, res, next) {
  let bus;
  try {
    const { driverId, ...busData } = req.body || {};
    bus = await Bus.create(busData);
    if (driverId) await assignDriverToBus(bus._id, driverId);
  } catch (e) {
    if (bus) {
      await Bus.deleteOne({ _id: bus._id });
      await User.updateOne({ assignedBusId: bus._id }, { $unset: { assignedBusId: 1 } });
    }
    next(e);
    return;
  }
  bus = await Bus.findById(bus._id)
    .populate("routeId", "name")
    .populate("driverId", "name email");
  res.status(201).json({ bus });
}
export async function update(req, res, next) {
  try {
    const { driverId, ...busData } = req.body || {};
    let bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (Object.hasOwn(req.body || {}, "driverId")) {
      await assignDriverToBus(bus._id, driverId);
    }
    if (Object.keys(busData).length) {
      bus = await Bus.findByIdAndUpdate(req.params.id, busData, {
        new: true,
        runValidators: true,
      });
    }
    bus = await Bus.findById(bus._id)
      .populate("routeId", "name")
      .populate("driverId", "name email");
    req.app
      .get("io")
      ?.to(`bus:${bus._id}`)
      .emit("bus:status", { busId: bus._id, status: bus.status });
    res.json({ bus });
  } catch (e) {
    next(e);
  }
}
export async function assignDriver(req, res, next) {
  try {
    if (!Object.hasOwn(req.body || {}, "driverId")) {
      return res.status(400).json({ message: "Provide a driver ID or null to unassign the bus." });
    }
    const bus = await assignDriverToBus(req.params.id, req.body?.driverId);
    const populatedBus = await Bus.findById(bus._id)
      .populate("routeId", "name")
      .populate("driverId", "name email");
    res.json({ bus: populatedBus });
  } catch (e) {
    next(e);
  }
}
export async function remove(req, res, next) {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (await Trip.exists({ busId: bus._id, status: "active" })) {
      return res.status(409).json({ message: "Stop the active trip before deleting this bus." });
    }
    await User.updateMany(
      { assignedBusId: bus._id },
      { $unset: { assignedBusId: 1 } },
    );
    await bus.deleteOne();
    res.json({ message: "Bus deleted" });
  } catch (e) {
    next(e);
  }
}
export async function location(req, res, next) {
  try {
    const bus = await Bus.findById(req.params.id).select(
      "currentLocation status lastUpdated",
    );
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    const stale =
      bus.lastUpdated &&
      Date.now() - new Date(bus.lastUpdated).getTime() >
        Number(process.env.LOCATION_STALE_MS || 120000);
    res.json({
      location: bus.currentLocation,
      status: stale ? "stale" : bus.status,
      lastUpdated: bus.lastUpdated,
    });
  } catch (e) {
    next(e);
  }
}
