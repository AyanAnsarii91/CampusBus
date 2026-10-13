import Bus from "../models/Bus.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import BusStop from "../models/BusStop.js";
import {
  buildEtas,
  computeStopDelay,
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
  const route = await Route.findById(bus.routeId)
    .populate("stops")
    .populate("eveningStops")
    .populate("scheduledStops.stopId")
    .populate("eveningScheduledStops.stopId");
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

  const isEvening = trip.shift === "evening";
  const rawStops = (isEvening && route?.eveningStops?.length ? route.eveningStops : route?.stops) || [];
  const stops = rawStops.filter(Boolean);
  const scheduledStops = (isEvening && route?.eveningScheduledStops?.length ? route.eveningScheduledStops : route?.scheduledStops) || [];

  const geocodedStops = stops.filter(
    (s) =>
      Number.isFinite(s?.latitude) &&
      s.latitude >= -90 &&
      s.latitude <= 90 &&
      Number.isFinite(s?.longitude) &&
      s.longitude >= -180 &&
      s.longitude <= 180,
  );
  const stopsToTrack =
    stops.length > 0 &&
      stops.every((s) => Number.isFinite(s?.latitude) && Number.isFinite(s?.longitude))
      ? stops
      : geocodedStops;

  const tracking = routeTrackingState(
    current,
    stopsToTrack,
    isStopped,
    STOP_PROXIMITY_METERS,
  );
  bus.currentLocation = current;
  bus.lastUpdated = receivedAt;
  bus.status = isStopped ? "stopped" : "active";
  await bus.save();

  // Record stop arrival if currently at stop
  if (tracking.currentStop) {
    const curStopIdStr = String(tracking.currentStop._id);
    const existing = (trip.stopArrivals || []).find((a) => String(a.stopId) === curStopIdStr);
    if (!existing) {
      if (!trip.stopArrivals) trip.stopArrivals = [];
      const sched = scheduledStops.find(
        (s) => String(s.stopId?._id || s.stopId) === curStopIdStr ||
          (s.place && s.place.trim().toLowerCase() === tracking.currentStop.name.trim().toLowerCase())
      );
      let delayMinutes = 0;
      if (sched?.time) {
        const d = computeStopDelay(sched.time, receivedAt, receivedAt);
        if (d) delayMinutes = d.diffMinutes;
      }
      trip.stopArrivals.push({
        stopId: tracking.currentStop._id,
        stopName: tracking.currentStop.name,
        arrivedAt: receivedAt,
        delayMinutes,
      });
      await trip.save();
    }
  }

  const etaByStop =
    tracking.stopLocationAvailable && tracking.nextStopIndex != null
      ? buildEtas(current, stopsToTrack, list, tracking.nextStopIndex)
      : {};

  // Compute live delays for upcoming stops based on ETA
  const delaysByStop = {};
  for (const stop of stopsToTrack) {
    const stopIdStr = String(stop._id);
    const etaItem = etaByStop[stopIdStr];
    const sched = scheduledStops.find(
      (s) => String(s.stopId?._id || s.stopId) === stopIdStr ||
        (s.place && s.place.trim().toLowerCase() === stop.name?.trim().toLowerCase())
    );
    if (sched?.time && etaItem?.arrival) {
      const delayObj = computeStopDelay(sched.time, etaItem.arrival, receivedAt);
      if (delayObj) delaysByStop[stopIdStr] = delayObj;
    }
  }

  return {
    busId,
    tripId,
    shift: trip.shift,
    ...current,
    etaByStop,
    delaysByStop,
    stopArrivals: trip.stopArrivals || [],
    status: bus.status,
    ...tracking,
    isStopped,
    isLive: true,
    stale: false,
  };
}

export async function getBusTrackingState(bus, activeTrip) {
  if (!bus || !activeTrip || !bus.currentLocation) return null;
  const route = await Route.findById(bus.routeId)
    .populate("stops")
    .populate("eveningStops")
    .populate("scheduledStops.stopId")
    .populate("eveningScheduledStops.stopId");

  const isEvening = activeTrip.shift === "evening";
  const rawStops =
    (isEvening && route?.eveningStops?.length ? route.eveningStops : route?.stops) || [];
  const stops = rawStops.filter(Boolean);
  const scheduledStops =
    (isEvening && route?.eveningScheduledStops?.length
      ? route.eveningScheduledStops
      : route?.scheduledStops) || [];

  const geocodedStops = stops.filter(
    (s) =>
      Number.isFinite(s?.latitude) &&
      s.latitude >= -90 &&
      s.latitude <= 90 &&
      Number.isFinite(s?.longitude) &&
      s.longitude >= -180 &&
      s.longitude <= 180,
  );
  const stopsToTrack =
    stops.length > 0 &&
    stops.every((s) => Number.isFinite(s?.latitude) && Number.isFinite(s?.longitude))
      ? stops
      : geocodedStops;

  const current = bus.currentLocation;
  const isStopped = bus.status === "stopped";
  const tracking = routeTrackingState(
    current,
    stopsToTrack,
    isStopped,
    STOP_PROXIMITY_METERS,
  );

  const list = speedCache.get(String(bus._id)) || [];
  const etaByStop =
    tracking.stopLocationAvailable && tracking.nextStopIndex != null
      ? buildEtas(current, stopsToTrack, list, tracking.nextStopIndex)
      : {};

  const delaysByStop = {};
  const receivedAt = current?.timestamp ? new Date(current.timestamp) : new Date();
  for (const stop of stopsToTrack) {
    const stopIdStr = String(stop._id);
    const etaItem = etaByStop[stopIdStr];
    const sched = scheduledStops.find(
      (s) =>
        String(s.stopId?._id || s.stopId) === stopIdStr ||
        (s.place && s.place.trim().toLowerCase() === stop.name?.trim().toLowerCase()),
    );
    if (sched?.time && etaItem?.arrival) {
      const delayObj = computeStopDelay(sched.time, etaItem.arrival, receivedAt);
      if (delayObj) delaysByStop[stopIdStr] = delayObj;
    }
  }

  return {
    ...tracking,
    etaByStop,
    delaysByStop,
    isStopped,
  };
}

export function clearSpeedCache(busId) {
  speedCache.delete(busId);
}
