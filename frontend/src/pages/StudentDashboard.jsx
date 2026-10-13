import { useEffect, useState } from "react";
import {
  Bell,
  BusFront,
  Clock3,
  Gauge,
  List,
  Map,
  MapPin,
  Navigation,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
  Timer,
} from "lucide-react";
import Layout from "../components/Layout";
import MapView from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import { busApi, routeApi } from "../services/api";
import { useBusSocket } from "../hooks/useBusSocket";
import { useAuth } from "../hooks/useAuth";

const fmt12h = (timeStr) => {
  if (!timeStr) return "";
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
  if (!match) return timeStr;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3];
  if (ampm) return `${h}:${m} ${ampm.toUpperCase()}`;
  const suffix = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
};

const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    : "—";

const getScheduledDate = (timeStr, baseDate = new Date()) => {
  if (!timeStr) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3]?.toUpperCase() === "PM" && h < 12) h += 12;
  if (match[3]?.toUpperCase() === "AM" && h === 12) h = 0;
  const d = new Date(baseDate);
  d.setHours(h, m, 0, 0);
  return d;
};

function calculateDelay(scheduledTime, etaArrival, actualArrival) {
  if (actualArrival) {
    const arrDate = new Date(actualArrival.arrivedAt || actualArrival);
    if (scheduledTime) {
      const match = String(scheduledTime).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (match[3]?.toUpperCase() === "PM" && h < 12) h += 12;
        if (match[3]?.toUpperCase() === "AM" && h === 12) h = 0;
        const sched = new Date(arrDate);
        sched.setHours(h, m, 0, 0);
        const diff = Math.round((arrDate.getTime() - sched.getTime()) / 60000);
        if (diff > 2) return { text: `${diff} min late`, type: "late", diff, actualTime: arrDate };
        if (diff < -2) return { text: `${Math.abs(diff)} min early`, type: "early", diff, actualTime: arrDate };
        return { text: "On time", type: "on_time", diff: 0, actualTime: arrDate };
      }
    }
    return { text: "Arrived", type: "arrived", actualTime: arrDate };
  }

  if (etaArrival && scheduledTime) {
    const predDate = new Date(etaArrival);
    const match = String(scheduledTime).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (match[3]?.toUpperCase() === "PM" && h < 12) h += 12;
      if (match[3]?.toUpperCase() === "AM" && h === 12) h = 0;
      const sched = new Date(predDate);
      sched.setHours(h, m, 0, 0);
      const diff = Math.round((predDate.getTime() - sched.getTime()) / 60000);
      if (diff > 2) return { text: `${diff} min late`, type: "late", diff, predictedTime: predDate };
      if (diff < -2) return { text: `${Math.abs(diff)} min early`, type: "early", diff, predictedTime: predDate };
      return { text: "On time", type: "on_time", diff: 0, predictedTime: predDate };
    }
  }

  return null;
}

const getNextScheduledDeparture = (scheduledStops, shift) => {
  if (!scheduledStops || !scheduledStops.length) return null;
  const origin = scheduledStops[0];
  const timeStr = origin.time;
  const place = origin.place;
  const now = new Date();
  const schedDate = getScheduledDate(timeStr, now);
  let isTomorrow = false;
  if (schedDate && now.getTime() > schedDate.getTime()) {
    isTomorrow = true;
  }
  return {
    timeStr,
    time12h: fmt12h(timeStr),
    place,
    isTomorrow,
    label: isTomorrow ? `Tomorrow at ${fmt12h(timeStr)}` : `Today at ${fmt12h(timeStr)}`,
  };
};

const hasStopCoordinates = (stops) =>
  stops.length > 0 &&
  stops.every(
    (stop) =>
      Number.isFinite(stop.latitude) &&
      stop.latitude >= -90 &&
      stop.latitude <= 90 &&
      Number.isFinite(stop.longitude) &&
      stop.longitude >= -180 &&
      stop.longitude <= 180,
  );

function findRouteProgress(stops, location) {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    stops.length < 2
  ) {
    return null;
  }
  if (
    stops.some(
      (stop) =>
        !Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude),
    )
  ) {
    return null;
  }
  const latitudeScale = Math.cos((location.latitude * Math.PI) / 180);
  const point = {
    x: location.longitude * latitudeScale,
    y: location.latitude,
  };
  let closest = { distance: Infinity, position: 0 };

  for (let index = 0; index < stops.length - 1; index++) {
    const start = {
      x: stops[index].longitude * latitudeScale,
      y: stops[index].latitude,
    };
    const end = {
      x: stops[index + 1].longitude * latitudeScale,
      y: stops[index + 1].latitude,
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared
      ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - start.x) * dx + (point.y - start.y) * dy) /
          lengthSquared,
        ),
      )
      : 0;
    const distance =
      (point.x - (start.x + fraction * dx)) ** 2 +
      (point.y - (start.y + fraction * dy)) ** 2;

    if (distance < closest.distance) {
      closest = { distance, position: index + fraction };
    }
  }

  return closest.position;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [busId, setBusId] = useState("");
  const [data, setData] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(user.assignedStop || "");
  const [trackingView, setTrackingView] = useState("route");
  const [shift, setShift] = useState(() => (new Date().getHours() >= 13 ? "evening" : "morning"));
  const [manualShiftSelected, setManualShiftSelected] = useState(false);
  const notified = useState(() => new Set())[0];
  const { location, connection } = useBusSocket(busId);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([busApi.list(), routeApi.list()]).then(([b, r]) => {
      setBuses(b.data.buses);
      setRoutes(r.data.routes);
      const preferred = user.assignedBusId || b.data.buses[0]?._id;
      setBusId(preferred || "");
    });
  }, [user]);

  useEffect(() => {
    setData(null);
  }, [busId]);

  useEffect(() => {
    if (!busId) return;
    let cancelled = false;
    busApi.location(busId).then((res) => {
      if (cancelled || !res.data) return;
      const loc = res.data.location;
      setData({
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
        speed: loc?.speed ?? null,
        heading: loc?.heading ?? null,
        accuracy: loc?.accuracy ?? null,
        timestamp: loc?.timestamp ?? res.data.lastUpdated ?? null,
        status: res.data.status,
        lastUpdated: res.data.lastUpdated,
        activeTrip: res.data.activeTrip,
        lastTrip: res.data.lastTrip,
        shift: res.data.activeTrip?.shift || null,
        stopArrivals: res.data.activeTrip?.stopArrivals || res.data.lastTrip?.stopArrivals || [],
        etaByStop: res.data.etaByStop || {},
        delaysByStop: res.data.delaysByStop || {},
        currentStop: res.data.currentStop || null,
        nearestStop: res.data.nearestStop || null,
        nextStop: res.data.nextStop || null,
        nextStopIndex: res.data.nextStopIndex ?? null,
        routeProgress: res.data.routeProgress ?? null,
        stopLocationAvailable: res.data.stopLocationAvailable ?? true,
        isLive: res.data.isLive ?? false,
        stale: res.data.stale ?? false,
      });
      if (res.data.activeTrip?.shift && !manualShiftSelected) {
        setShift(res.data.activeTrip.shift);
      }
    }).catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [busId, manualShiftSelected]);

  useEffect(() => {
    if (location) {
      setData((p) => {
        if (location.tripEnded) {
          return {
            ...(p || {}),
            ...location,
            latitude: null,
            longitude: null,
            speed: null,
            etaByStop: {},
            delaysByStop: {},
            activeTrip: null,
            isLive: false,
          };
        }
        return { ...(p || {}), ...location };
      });
      if (location.shift && !manualShiftSelected && location.activeTrip) {
        setShift(location.shift);
      }
    }
  }, [location, manualShiftSelected]);

  const bus = buses.find((b) => b._id === busId);
  const routeId =
    typeof bus?.routeId === "string" ? bus.routeId : bus?.routeId?._id;
  const route = routes.find((r) => r._id === routeId);

  const isEvening = shift === "evening";
  const routeStops = (isEvening && route?.eveningStops?.length ? route.eveningStops : (route?.stops || [])).filter(Boolean);
  const scheduledStops = (isEvening && route?.eveningScheduledStops?.length ? route.eveningScheduledStops : (route?.scheduledStops || [])).filter(Boolean);

  const isTripActiveForShift = Boolean(
    data?.activeTrip &&
    data.activeTrip.shift === shift
  );

  const FRESHNESS_THRESHOLD_MS = 120000;
  const timestamp = isTripActiveForShift ? (data?.timestamp || data?.lastUpdated) : null;
  const ageSeconds = timestamp
    ? Math.max(0, Math.round((now.getTime() - new Date(timestamp).getTime()) / 1000))
    : null;
  const isGpsStale = isTripActiveForShift && (
    !timestamp ||
    (now.getTime() - new Date(timestamp).getTime() > FRESHNESS_THRESHOLD_MS) ||
    data?.status === "stale" ||
    data?.stale === true
  );

  const isLiveTrackingActive = Boolean(
    isTripActiveForShift &&
    !isGpsStale &&
    Number.isFinite(data?.latitude) &&
    Number.isFinite(data?.longitude) &&
    data?.isLive !== false
  );

  const hasBackendConfirmedTripEnd = Boolean(
    (data?.tripEnded && (!data?.tripEndedData?.shift || data.tripEndedData.shift === shift)) ||
    (!isTripActiveForShift &&
      data?.lastTrip?.status === "ended" &&
      data.lastTrip.shift === shift &&
      (() => {
        if (!data.lastTrip.endedAt) return false;
        const endedMs = new Date(data.lastTrip.endedAt).getTime();
        const diffMs = now.getTime() - endedMs;
        return diffMs >= 0 && diffMs <= 2 * 60 * 60 * 1000;
      })()
    )
  );

  const tripEndedAt = data?.tripEndedData?.endedAt || (hasBackendConfirmedTripEnd ? data?.lastTrip?.endedAt : null);

  const stops = routeStops.length
    ? routeStops.map((stop, index) => {
      const sched = scheduledStops.find(
        (s) =>
          String(s.stopId?._id || s.stopId) === String(stop._id) ||
          (s.place && s.place.trim().toLowerCase() === stop.name?.trim().toLowerCase())
      );
      const scheduledTime = sched?.time || stop.scheduledTime || "";
      const actualArrival = (isLiveTrackingActive || hasBackendConfirmedTripEnd)
        ? (data?.stopArrivals || []).find(
            (a) =>
              String(a.stopId) === String(stop._id) ||
              (a.stopName && a.stopName.trim().toLowerCase() === stop.name?.trim().toLowerCase())
          )
        : null;
      const eta = isLiveTrackingActive ? data?.etaByStop?.[stop._id] : null;
      const delay = isLiveTrackingActive
        ? calculateDelay(scheduledTime, eta?.arrival, actualArrival)
        : (actualArrival ? calculateDelay(scheduledTime, null, actualArrival) : null);

      return {
        ...stop,
        key: stop._id,
        label: stop.name,
        index,
        scheduledTime,
        actualArrival,
        eta,
        delay,
      };
    })
    : scheduledStops.map((stop, index) => ({
      ...stop,
      key: `scheduled-${index}`,
      label: stop.place,
      index,
      scheduledTime: stop.time,
      scheduledOnly: true,
      delay: null,
    }));

  const routeCoordinatesAvailable = hasStopCoordinates(routeStops);
  const stopLocationUnavailable =
    stops.length > 0 &&
    (!routeCoordinatesAvailable || (isLiveTrackingActive && data?.stopLocationAvailable === false));
  const gpsProgress = isLiveTrackingActive && routeCoordinatesAvailable
    ? Number.isFinite(data?.routeProgress)
      ? data.routeProgress
      : findRouteProgress(routeStops, data)
    : null;
  const currentStop = isLiveTrackingActive ? (data?.currentStop || null) : null;
  const nearestStop = isLiveTrackingActive ? (data?.nearestStop || null) : null;
  const isStopped = isLiveTrackingActive && (data?.status === "stopped" || bus?.status === "stopped");
  const currentStopIndex = currentStop
    ? stops.findIndex((stop) => String(stop._id) === String(currentStop._id))
    : -1;
  const reportedNextStopIndex = isLiveTrackingActive && data?.nextStop
    ? stops.findIndex((stop) => String(stop._id) === String(data.nextStop._id))
    : -1;
  const etaNextIndex = isLiveTrackingActive
    ? stops.findIndex((stop) => stop._id && data?.etaByStop?.[stop._id])
    : -1;
  const nextStopIndex = (!isLiveTrackingActive || stopLocationUnavailable)
    ? -1
    : reportedNextStopIndex >= 0
      ? reportedNextStopIndex
      : isStopped && currentStopIndex >= 0
        ? Math.min(stops.length - 1, currentStopIndex + 1)
        : gpsProgress != null
          ? Math.min(stops.length - 1, Math.ceil(gpsProgress))
          : etaNextIndex;
  const nextStop = nextStopIndex >= 0 ? stops[nextStopIndex] : null;
  const selected =
    stops.find((stop) => stop.key === selectedStopId) || nextStop || stops[0];
  const eta = isLiveTrackingActive ? data?.etaByStop?.[selected?._id] : null;
  const nextEta = isLiveTrackingActive ? data?.etaByStop?.[nextStop?._id] : null;

  const finalStop = stops.length > 0 ? stops[stops.length - 1] : null;
  const finalStopActualArrival =
    finalStop?.actualArrival ||
    (data?.stopArrivals || []).find(
      (a) =>
        (finalStop?._id && String(a.stopId) === String(finalStop._id)) ||
        (a.stopName && finalStop?.label && a.stopName.trim().toLowerCase() === finalStop.label.trim().toLowerCase())
    );

  const status = hasBackendConfirmedTripEnd
    ? "completed"
    : isGpsStale
      ? "stale"
      : isLiveTrackingActive
        ? (isStopped ? "stopped" : "active")
        : "no_active_trip";

  const nextDeparture = getNextScheduledDeparture(scheduledStops, shift);

  const stoppedMessage = currentStop?.name
    ? `Stopped at/near ${currentStop.name}`
    : nearestStop?.name
      ? `Stopped · nearest stop ${nearestStop.name}${nearestStop.distanceKm != null ? ` · ${nearestStop.distanceKm.toFixed(1)} km away` : ""}`
      : "Stopped";

  const distanceDisplay = hasBackendConfirmedTripEnd
    ? "Trip Completed"
    : isGpsStale
      ? "Live location unavailable"
      : isLiveTrackingActive
        ? (stopLocationUnavailable
          ? "Stop location unavailable"
          : nextEta?.distanceKm != null
            ? `${nextEta.distanceKm.toFixed(1)} km`
            : "—")
        : "—";

  const etaDisplay = hasBackendConfirmedTripEnd
    ? (tripEndedAt ? `Ended: ${fmtTime(tripEndedAt)}` : "Trip Completed")
    : isGpsStale
      ? "Live location unavailable"
      : isLiveTrackingActive
        ? (stopLocationUnavailable
          ? "Stop location unavailable"
          : nextEta?.minutes != null
            ? `~${nextEta.minutes} min (${fmtTime(nextEta.arrival)})`
            : nextStop?.scheduledTime
              ? `Sched: ${fmt12h(nextStop.scheduledTime)}`
              : "—")
        : "No active trip";

  const schedArrivalDisplay = isLiveTrackingActive && nextStop?.scheduledTime
    ? fmt12h(nextStop.scheduledTime)
    : (nextDeparture ? nextDeparture.time12h : "—");

  const positionPercent =
    isLiveTrackingActive && gpsProgress != null && stops.length
      ? ((gpsProgress + 0.5) / stops.length) * 100
      : null;

  useEffect(() => {
    setSelectedStopId(user.assignedStop || "");
  }, [user.assignedStop, busId]);

  useEffect(() => {
    const e = selected && data?.etaByStop?.[selected._id];
    if (
      isLiveTrackingActive &&
      selected?._id &&
      e?.minutes != null &&
      e.minutes <= 5 &&
      !notified.has(selected._id)
    ) {
      notified.add(selected._id);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("CampusBus", {
          body: `${bus?.busNumber || "Your bus"} is arriving at ${selected.label} in about ${e.minutes} min.`,
        });
      }
    }
  }, [isLiveTrackingActive, data, selected, bus?.busNumber]);

  return (
    <Layout>
      <div className="space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                CampusBus · Live tracking & delays
              </p>
              {isLiveTrackingActive && data?.shift && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  Live {data.shift} trip
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Your bus, stop by stop
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <BusFront size={18} className="shrink-0 text-slate-500" />
              <span className="sr-only">Select a bus</span>
              <select
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              >
                {buses.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.busNumber} · {routes.find((r) => r._id === item.routeId)?.name || "Route"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {/* Shift Selector: Morning Pickup / Evening Drop */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Schedule:
            </span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Trip schedule shift">
              <button
                type="button"
                role="tab"
                aria-selected={shift === "morning"}
                onClick={() => {
                  setShift("morning");
                  setManualShiftSelected(true);
                }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${shift === "morning"
                  ? "bg-white text-amber-700 shadow-xs dark:bg-slate-900 dark:text-amber-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
              >
                <Sun size={14} className={shift === "morning" ? "text-amber-500" : "text-slate-400"} />
                <span>Morning Pickup</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shift === "evening"}
                onClick={() => {
                  setShift("evening");
                  setManualShiftSelected(true);
                }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${shift === "evening"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-900 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
              >
                <Moon size={14} className={shift === "evening" ? "text-indigo-500" : "text-slate-400"} />
                <span>Evening Drop (3:30 PM)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            {shift === "morning" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                <Sun size={12} /> Morning Pickup to College Gate
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                <Moon size={12} /> Evening Return from College (Departs 3:30 PM)
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5 dark:border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-black uppercase text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                    {route?.routeNumber ? `Bus No. ${route.routeNumber}` : "Bus"}
                  </span>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    {shift === "evening" ? "Evening Return Route" : "Morning Pickup Route"}
                  </p>
                </div>
                <h2 className="mt-1 truncate text-lg font-black text-slate-900 dark:text-white">
                  {route?.direction || route?.name || "No route assigned"}
                </h2>
              </div>
              <div className="flex items-center gap-2 self-start rounded-lg bg-slate-100 p-1 sm:self-auto dark:bg-slate-800" role="tablist" aria-label="Tracking view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={trackingView === "route"}
                  onClick={() => setTrackingView("route")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors ${trackingView === "route" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}
                >
                  <List size={16} /> Route
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={trackingView === "map"}
                  onClick={() => setTrackingView("map")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors ${trackingView === "map" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}
                >
                  <Map size={16} /> Map
                </button>
              </div>
            </div>

            {trackingView === "map" ? (
              <div className="h-[55vh] min-h-[360px]">
                <MapView
                  location={isLiveTrackingActive ? data : null}
                  stops={routeStops}
                  route={routeStops}
                  selectedStopId={selected?._id}
                />
              </div>
            ) : stops.length ? (
              <div className="p-3 sm:p-5">
                <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors ${hasBackendConfirmedTripEnd
                  ? "bg-emerald-50/80 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : isGpsStale
                    ? "bg-amber-50/80 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                    : isLiveTrackingActive
                      ? "bg-slate-50 dark:bg-slate-800/50"
                      : "bg-slate-50 border border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-700/60"
                  }`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${hasBackendConfirmedTripEnd
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                      : isGpsStale
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                        : isLiveTrackingActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>
                      {hasBackendConfirmedTripEnd ? (
                        <CheckCircle2 size={18} />
                      ) : isGpsStale ? (
                        <AlertTriangle size={18} />
                      ) : isLiveTrackingActive ? (
                        <Wifi size={17} />
                      ) : (
                        <Clock3 size={17} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {hasBackendConfirmedTripEnd
                          ? "Trip Completed"
                          : isGpsStale
                            ? "Live location unavailable"
                            : isLiveTrackingActive
                              ? (isStopped ? stoppedMessage : nextStop ? `Next: ${nextStop.label}` : "Bus en route")
                              : "No Active Trip"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                        {hasBackendConfirmedTripEnd ? (
                          <>
                            <span>Trip confirmed ended by backend</span>
                            {tripEndedAt && <span>· Ended: {fmtTime(tripEndedAt)}</span>}
                            {finalStop?.label && <span>· Final stop: <strong className="text-slate-700 dark:text-slate-300">{finalStop.label}</strong></span>}
                          </>
                        ) : isGpsStale ? (
                          <span>GPS signal stale ({ageSeconds != null ? `${ageSeconds}s ago` : "awaiting signal"}). Live tracking will resume on driver fix.</span>
                        ) : isLiveTrackingActive ? (
                          stopLocationUnavailable ? (
                            <span>Add valid latitude/longitude stops and attach them to this route.</span>
                          ) : nextEta?.minutes != null ? (
                            <>
                              <span>Arrives in about {nextEta.minutes} min ({fmtTime(nextEta.arrival)})</span>
                              {nextStop?.delay && (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${nextStop.delay.type === "late"
                                  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                                  : nextStop.delay.type === "early"
                                    ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  }`}>
                                  {nextStop.delay.text}
                                </span>
                              )}
                            </>
                          ) : nextStop?.scheduledTime ? (
                            <span>Scheduled for {fmt12h(nextStop.scheduledTime)}</span>
                          ) : (
                            <span>Live GPS tracking active</span>
                          )
                        ) : (
                          <>
                            {data?.activeTrip && data.activeTrip.shift !== shift ? (
                              <span>Bus is currently on {data.activeTrip.shift === "morning" ? "Morning Pickup" : "Evening Drop"} trip. Switch shift to track live.</span>
                            ) : nextDeparture ? (
                              <span>Next departure: <strong className="text-slate-700 dark:text-slate-300">{nextDeparture.label}</strong> from {nextDeparture.place}</span>
                            ) : (
                              <span>No scheduled departures for this shift.</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {stopLocationUnavailable && (
                  <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Stop location unavailable. This route needs stops with valid coordinates before live distance, ETA, or route progress can be calculated. Any listed times are schedule times only.
                  </p>
                )}

                <div className="relative overflow-hidden" role="list" aria-label="Bus route stop progress">
                  <div className="absolute bottom-10 left-[21px] top-10 w-0.5 bg-slate-200 dark:bg-slate-800" />
                  {positionPercent != null && (
                    <div
                      className="pointer-events-none absolute left-[21px] z-20 -translate-x-1/2 -translate-y-1/2 transition-[top] duration-700 ease-out"
                      style={{ top: `${positionPercent}%` }}
                      aria-label="Bus current GPS position"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-white bg-blue-700 text-white shadow-lg ring-2 ring-blue-100">
                        <BusFront size={18} />
                      </span>
                    </div>
                  )}
                  {stops.map((stop, index) => {
                    const isNext = index === nextStopIndex;
                    const isComplete = nextStopIndex >= 0 && index < nextStopIndex;
                    const isSelected = selected?.key === stop.key;
                    const stopEta = stop._id ? data?.etaByStop?.[stop._id] : null;

                    return (
                      <div key={stop.key} role="listitem" className="relative min-h-20 py-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedStopId(stop.key)}
                          aria-current={isNext ? "step" : undefined}
                          className={`flex h-full w-full items-center gap-3 rounded-xl px-2 text-left transition-colors sm:px-3 ${isNext
                            ? "bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900"
                            : isSelected
                              ? "bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent"
                            }`}
                        >
                          <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white shadow-sm dark:border-slate-900">
                            {stop.actualArrival || isComplete ? (
                              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            ) : isNext ? (
                              <span className="h-3.5 w-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/50" />
                            ) : (
                              <span className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm ${isNext ? "font-black text-blue-950 dark:text-blue-300" : isComplete ? "font-semibold text-slate-500" : "font-semibold text-slate-800 dark:text-slate-200"}`}>
                              {stop.label}
                            </span>
                            <span className={`mt-0.5 flex flex-wrap items-center gap-2 text-xs ${isNext ? "font-bold text-blue-700 dark:text-blue-400" : "text-slate-400"}`}>
                              <span>
                                {stop.actualArrival
                                  ? `Arrived at ${fmtTime(stop.actualArrival.arrivedAt)}`
                                  : isComplete
                                    ? "Passed"
                                    : isNext
                                      ? "Approaching next"
                                      : `Stop ${index + 1}`}
                              </span>
                              {stop.scheduledTime && (
                                <span className="font-semibold text-slate-500 tabular-nums">
                                  · Sched: {fmt12h(stop.scheduledTime)}
                                </span>
                              )}
                            </span>
                          </span>

                          <span className="shrink-0 text-right">
                            {stop.actualArrival ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  {fmtTime(stop.actualArrival.arrivedAt)}
                                </span>
                                {stop.delay && (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${stop.delay.type === "late"
                                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                                    : stop.delay.type === "early"
                                      ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}>
                                    {stop.delay.text}
                                  </span>
                                )}
                              </div>
                            ) : isLiveTrackingActive && stopEta?.minutes != null ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`block text-sm font-black tabular-nums ${isNext ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
                                  ~{stopEta.minutes} min
                                </span>
                                {stopEta.arrival && (
                                  <span className="block text-[11px] font-medium text-slate-500 tabular-nums">
                                    {fmtTime(stopEta.arrival)}
                                  </span>
                                )}
                                {stop.delay && (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${stop.delay.type === "late"
                                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                                    : stop.delay.type === "early"
                                      ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}>
                                    {stop.delay.text}
                                  </span>
                                )}
                              </div>
                            ) : stop.scheduledTime ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="block text-sm font-bold tabular-nums text-slate-700 dark:text-slate-300">
                                  {fmt12h(stop.scheduledTime)}
                                </span>
                                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  Scheduled
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">ETA unavailable</span>
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center px-6 text-center">
                <div>
                  <MapPin className="mx-auto text-slate-300" size={28} />
                  <p className="mt-3 font-bold text-slate-700">No stops on this route yet</p>
                  <p className="mt-1 text-sm text-slate-500">Route progress will appear when stops are assigned.</p>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold uppercase text-slate-400">Tracking bus</p>
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                      {shift}
                    </span>
                  </div>
                  <h2 className="mt-1 truncate text-xl font-black">{bus?.busNumber || "—"}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{route?.direction || route?.name || "No route assigned"}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-500">Active Shift</dt>
                  <dd className="font-bold text-slate-900 dark:text-white capitalize">
                    {shift === "evening" ? "Evening Drop (3:30 PM)" : "Morning Pickup"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-500">Current stop</dt>
                  <dd className="max-w-[60%] text-right font-semibold">
                    {hasBackendConfirmedTripEnd
                      ? (finalStop?.label ? `Completed (${finalStop.label})` : "Trip Completed")
                      : isGpsStale
                        ? "Live location unavailable"
                        : isLiveTrackingActive
                          ? (currentStop?.name || (isStopped ? stoppedMessage : "Between stops"))
                          : "No active trip"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-slate-500"><Navigation size={15} /> Next stop</dt>
                  <dd className="text-right font-bold truncate max-w-[55%]">
                    {isLiveTrackingActive ? (nextStop?.label || "—") : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-slate-500"><Timer size={15} /> Sched. Arrival</dt>
                  <dd className="text-right font-bold tabular-nums">
                    {isLiveTrackingActive && nextStop?.scheduledTime ? fmt12h(nextStop.scheduledTime) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-slate-500"><Clock3 size={15} /> Predicted / ETA</dt>
                  <dd className={`text-right font-bold ${stopLocationUnavailable ? "max-w-36 text-xs text-amber-700" : "tabular-nums"}`}>{etaDisplay}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-500">Delay Status</dt>
                  <dd className="text-right font-bold">
                    {isLiveTrackingActive && nextStop?.delay ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${nextStop.delay.type === "late"
                        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                        : nextStop.delay.type === "early"
                          ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}>
                        {nextStop.delay.text}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-slate-500"><Gauge size={15} /> Speed</dt>
                  <dd className="font-bold tabular-nums">{isLiveTrackingActive && data?.speed != null ? `${Math.round(data.speed)} km/h` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="font-semibold">{isLiveTrackingActive && ageSeconds != null ? `${ageSeconds}s ago` : isGpsStale && ageSeconds != null ? `${ageSeconds}s ago (stale)` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-500">Connection</dt>
                  <dd className={connection === "connected" ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                    {connection === "connected" ? "Live" : "Reconnecting"}
                  </dd>
                </div>
              </dl>
              {isLiveTrackingActive && data?.latitude != null && data?.longitude != null && (
                <p className="border-t border-slate-100 pt-3 text-xs tabular-nums text-slate-400 dark:border-slate-800">
                  GPS {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Bell size={17} /> Stop alerts
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Get a notification when your selected stop is five minutes away.
              </p>
              <button
                type="button"
                onClick={() => {
                  if ("Notification" in window) Notification.requestPermission();
                }}
                className="mt-3 text-sm font-bold text-blue-700 hover:text-blue-900 dark:text-blue-400"
              >
                Enable alerts
              </button>
              {selected && (
                <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 space-y-1">
                  <p>
                    Selected stop: <strong className="text-slate-700 dark:text-slate-300">{selected.label}</strong>
                  </p>
                  {selected.scheduledTime && (
                    <p>Scheduled: <strong className="tabular-nums">{fmt12h(selected.scheduledTime)}</strong></p>
                  )}
                  {eta?.minutes != null && (
                    <p className="text-blue-600 dark:text-blue-400 font-bold">
                      Predicted arrival: ~{eta.minutes} min ({fmtTime(eta.arrival)})
                    </p>
                  )}
                  {selected.delay && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${selected.delay.type === "late"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : selected.delay.type === "early"
                        ? "bg-sky-100 text-sky-800 border-sky-300"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}>
                      {selected.delay.text}
                    </span>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
