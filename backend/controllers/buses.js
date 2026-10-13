import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import { assignDriverToBus } from "../services/driverAssignments.js";
import { getBusTrackingState } from "../services/location.js";
export async function list(req, res, next) {
  try {
    const buses = await Bus.find()
      .populate("routeId", "name routeNumber direction")
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
    if (busData.routeId === "") busData.routeId = null;
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
    .populate("routeId", "name routeNumber direction")
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
      if (busData.routeId === "") busData.routeId = null;
      bus = await Bus.findByIdAndUpdate(req.params.id, busData, {
        new: true,
        runValidators: true,
      });
    }
    bus = await Bus.findById(bus._id)
      .populate("routeId", "name routeNumber direction")
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
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });

    const activeTrip = await Trip.findOne({ busId: bus._id, status: "active" });
    const lastTrip = activeTrip
      ? null
      : await Trip.findOne({ busId: bus._id, status: "ended" }).sort({ endedAt: -1, createdAt: -1 });

    if (!activeTrip) {
      return res.json({
        location: null,
        status: "offline",
        lastUpdated: null,
        activeTrip: null,
        lastTrip: lastTrip
          ? {
              _id: lastTrip._id,
              status: lastTrip.status,
              shift: lastTrip.shift,
              stopArrivals: lastTrip.stopArrivals || [],
              startedAt: lastTrip.startedAt,
              endedAt: lastTrip.endedAt,
            }
          : null,
        etaByStop: {},
        delaysByStop: {},
        isLive: false,
        stale: false,
      });
    }

    const staleThreshold = Number(process.env.LOCATION_STALE_MS || 120000);
    const gpsTimestamp = bus.currentLocation?.timestamp || bus.lastUpdated;
    const hasCoords =
      Number.isFinite(bus.currentLocation?.latitude) &&
      Number.isFinite(bus.currentLocation?.longitude);
    const isStale =
      !hasCoords ||
      !gpsTimestamp ||
      Date.now() - new Date(gpsTimestamp).getTime() > staleThreshold;

    if (isStale) {
      return res.json({
        location: null,
        status: "stale",
        lastUpdated: gpsTimestamp || null,
        activeTrip: {
          _id: activeTrip._id,
          status: "active",
          shift: activeTrip.shift,
          stopArrivals: activeTrip.stopArrivals || [],
          startedAt: activeTrip.startedAt,
        },
        lastTrip: null,
        etaByStop: {},
        delaysByStop: {},
        isLive: false,
        stale: true,
      });
    }

    const telemetry = await getBusTrackingState(bus, activeTrip);
    res.json({
      location: {
        latitude: bus.currentLocation.latitude,
        longitude: bus.currentLocation.longitude,
        speed: bus.currentLocation.speed,
        heading: bus.currentLocation.heading,
        accuracy: bus.currentLocation.accuracy,
        timestamp: bus.currentLocation.timestamp,
      },
      status: bus.status,
      lastUpdated: bus.lastUpdated,
      activeTrip: {
        _id: activeTrip._id,
        status: "active",
        shift: activeTrip.shift,
        stopArrivals: activeTrip.stopArrivals || [],
        startedAt: activeTrip.startedAt,
      },
      lastTrip: null,
      stopArrivals: activeTrip.stopArrivals || [],
      ...(telemetry || {}),
      isLive: true,
      stale: false,
    });
  } catch (e) {
    next(e);
  }
}
