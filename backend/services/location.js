import Bus from "../models/Bus.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import BusStop from "../models/BusStop.js";
import {
  buildEtas,
  routeTrackingState,
} from "./eta.js";
const speedCache = new Map();

function setting(name, fallback, minimum = 0) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

const STOPPED_SPEED_THRESHOLD_KMH = setting(
  "BUS_STOPPED_SPEED_THRESHOLD_KMH",
  1.5,
);
const STOPPED_DURATION_MS = setting("BUS_STOPPED_DURATION_MS", 90000, 1000);
const STOP_PROXIMITY_METERS = setting("BUS_STOP_PROXIMITY_METERS", 120, 1);

export function evaluateStoppedState(speed, previousLowSpeedSince, receivedAt = new Date()) {
  if (speed == null || speed > STOPPED_SPEED_THRESHOLD_KMH) {
    return { lowSpeedSince: null, isStopped: false };
  }
  const previousTime =
    previousLowSpeedSince == null
      ? Number.NaN
      : new Date(previousLowSpeedSince).getTime();
  const receivedTime = new Date(receivedAt).getTime();
  const lowSpeedSince =
    Number.isFinite(previousTime) && previousTime <= receivedTime
      ? new Date(previousTime)
      : new Date(receivedTime);
  return {
    lowSpeedSince,
    isStopped: receivedTime - lowSpeedSince.getTime() >= STOPPED_DURATION_MS,
  };
}

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
  if (
    speed != null &&
    (!Number.isFinite(speed) || speed < 0 || speed > 200)
  ) {
    throw Object.assign(new Error("Invalid GPS speed"), { status: 400 });
  }
  const trip = await Trip.findOne({ _id: tripId, busId, status: "active" });
  if (!trip)
    throw Object.assign(new Error("Active trip not found"), { status: 403 });
  const bus = await Bus.findById(busId);
  if (!bus) throw Object.assign(new Error("Bus not found"), { status: 404 });
  const route = await Route.findById(bus.routeId).populate({
    path: "stops",
    options: { sort: { sequence: 1 } },
  });
  const list = speedCache.get(busId) || [];
  if (Number.isFinite(speed)) list.push(speed);
  while (list.length > 8) list.shift();
  speedCache.set(busId, list);
  const currentSpeed = Number.isFinite(speed) ? speed : null;
  const receivedAt = new Date();
  const { lowSpeedSince, isStopped } = evaluateStoppedState(
    currentSpeed,
    bus.currentLocation?.lowSpeedSince,
    receivedAt,
  );
  const current = {
    latitude,
    longitude,
    speed: currentSpeed,
    heading,
    accuracy,
    timestamp: new Date(timestamp || Date.now()),
    lowSpeedSince,
  };
  const stops = route?.stops || [];
  const tracking = routeTrackingState(
    current,
    stops,
    isStopped,
    STOP_PROXIMITY_METERS,
  );
  bus.currentLocation = current;
  bus.lastUpdated = receivedAt;
  bus.status = isStopped ? "stopped" : "active";
  await bus.save();
  const etaByStop =
    tracking.stopLocationAvailable && tracking.nextStopIndex != null
      ? buildEtas(current, stops, list, tracking.nextStopIndex)
      : {};
  return {
    busId,
    tripId,
    ...current,
    etaByStop,
    status: bus.status,
    ...tracking,
    isStopped,
  };
}
export function clearSpeedCache(busId) {
  speedCache.delete(busId);
}
