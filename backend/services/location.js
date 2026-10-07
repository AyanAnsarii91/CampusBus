import Bus from "../models/Bus.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import BusStop from "../models/BusStop.js";
import { buildEtas } from "./eta.js";
const speedCache = new Map();
export async function processLocation(payload) {
  const {
    busId,
    tripId,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    timestamp,
  } = payload;
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw Object.assign(new Error("Invalid GPS coordinates"), { status: 400 });
  if (accuracy != null && accuracy > 1000)
    throw Object.assign(new Error("GPS accuracy is too poor"), { status: 400 });
  const trip = await Trip.findOne({ _id: tripId, busId, status: "active" });
  if (!trip)
    throw Object.assign(new Error("Active trip not found"), { status: 403 });
  const bus = await Bus.findById(busId);
  if (!bus) throw Object.assign(new Error("Bus not found"), { status: 404 });
  const route = await Route.findById(bus.routeId).populate("stops");
  const list = speedCache.get(busId) || [];
  if (Number.isFinite(speed)) list.push(speed);
  while (list.length > 8) list.shift();
  speedCache.set(busId, list);
  const current = {
    latitude,
    longitude,
    speed: Number.isFinite(speed) ? speed : 0,
    heading,
    accuracy,
    timestamp: new Date(timestamp || Date.now()),
  };
  bus.currentLocation = current;
  bus.lastUpdated = current.timestamp;
  bus.status = "active";
  await bus.save();
  const etaByStop = buildEtas(current, route?.stops || [], list);
  return { busId, tripId, ...current, etaByStop, status: bus.status };
}
export function clearSpeedCache(busId) {
  speedCache.delete(busId);
}
