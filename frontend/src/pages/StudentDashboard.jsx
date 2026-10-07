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
} from "lucide-react";
import Layout from "../components/Layout";
import MapView from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import { busApi, routeApi } from "../services/api";
import { useBusSocket } from "../hooks/useBusSocket";
import { useAuth } from "../hooks/useAuth";

const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

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
  const notified = useState(() => new Set())[0];
  const { location, connection } = useBusSocket(busId);

  useEffect(() => {
    Promise.all([busApi.list(), routeApi.list()]).then(([b, r]) => {
      setBuses(b.data.buses);
      setRoutes(r.data.routes);
      const preferred = user.assignedBusId || b.data.buses[0]?._id;
      setBusId(preferred || "");
    });
  }, [user]);

  useEffect(() => {
    if (location) setData((p) => ({ ...p, ...location }));
  }, [location]);

  const bus = buses.find((b) => b._id === busId);
  const routeId =
    typeof bus?.routeId === "string" ? bus.routeId : bus?.routeId?._id;
  const route = routes.find((r) => r._id === routeId);
  const routeStops = route?.stops || [];
  const stops = routeStops.length
    ? routeStops.map((stop, index) => ({
        ...stop,
        key: stop._id,
        label: stop.name,
        index,
      }))
    : (route?.scheduledStops || []).map((stop, index) => ({
        ...stop,
        key: `scheduled-${index}`,
        label: stop.place,
        index,
        scheduledOnly: true,
      }));
  const routeCoordinatesAvailable = hasStopCoordinates(routeStops);
  const stopLocationUnavailable =
    stops.length > 0 &&
    (!routeCoordinatesAvailable || data?.stopLocationAvailable === false);
  const gpsProgress = routeCoordinatesAvailable
    ? Number.isFinite(data?.routeProgress)
      ? data.routeProgress
      : findRouteProgress(routeStops, data)
    : null;
  const currentStop = data?.currentStop || null;
  const nearestStop = data?.nearestStop || null;
  const isStopped = data?.status === "stopped" || bus?.status === "stopped";
  const currentStopIndex = currentStop
    ? stops.findIndex((stop) => String(stop._id) === String(currentStop._id))
    : -1;
  const reportedNextStopIndex = data?.nextStop
    ? stops.findIndex((stop) => String(stop._id) === String(data.nextStop._id))
    : -1;
  const etaNextIndex = stops.findIndex(
    (stop) => stop._id && data?.etaByStop?.[stop._id],
  );
  const nextStopIndex = stopLocationUnavailable
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
  const eta = data?.etaByStop?.[selected?._id];
  const nextEta = data?.etaByStop?.[nextStop?._id];
  const timestamp = data?.timestamp || bus?.lastUpdated;
  const stale = timestamp
    ? Date.now() - new Date(timestamp).getTime() > 120000
    : false;
  const status = stale ? "stale" : data?.status || bus?.status || "offline";
  const stoppedMessage = currentStop?.name
    ? `Stopped at/near ${currentStop.name}`
    : nearestStop?.name
      ? `Stopped · nearest stop ${nearestStop.name}${nearestStop.distanceKm != null ? ` · ${nearestStop.distanceKm.toFixed(1)} km away` : ""}`
      : "Stopped";
  const distanceDisplay = stopLocationUnavailable
    ? "Stop location unavailable"
    : nextEta?.distanceKm != null
      ? `${nextEta.distanceKm.toFixed(1)} km`
      : nextStop
        ? "Waiting for GPS"
        : "No upcoming stop";
  const etaDisplay = stopLocationUnavailable
    ? "Stop location unavailable"
    : nextEta?.minutes != null
      ? `~${nextEta.minutes} min`
      : nextStop?.time || (nextStop ? "Waiting for GPS" : "No upcoming stop");
  const positionPercent =
    gpsProgress != null && stops.length
      ? ((gpsProgress + 0.5) / stops.length) * 100
      : null;

  useEffect(() => {
    setSelectedStopId(user.assignedStop || "");
  }, [user.assignedStop, busId]);

  useEffect(() => {
    const e = selected && data?.etaByStop?.[selected._id];
    if (
      selected?._id &&
      e?.minutes != null &&
      e.minutes <= 5 &&
      !notified.has(selected._id)
    ) {
      notified.add(selected._id);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("CampusBus", {
          body: `${bus?.busNumber || "Your bus"} is arriving at ${selected.name} in about ${e.minutes} min.`,
        });
      }
    }
  }, [data, selected, bus?.busNumber]);

  const ageSeconds = timestamp
    ? Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000))
    : null;

  return (
    <Layout>
      <div className="space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-blue-700">CampusBus · Live tracking</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Your bus, stop by stop
            </h1>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
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
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  {route?.routeNumber ? `Route ${route.routeNumber}` : route?.direction || "Current route"}
                </p>
                <h2 className="mt-1 truncate text-lg font-black text-slate-900">
                  {route?.direction || route?.name || "No route assigned"}
                </h2>
              </div>
              <div className="flex items-center gap-2 self-start rounded-lg bg-slate-100 p-1 sm:self-auto" role="tablist" aria-label="Tracking view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={trackingView === "route"}
                  onClick={() => setTrackingView("route")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors ${trackingView === "route" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <List size={16} /> Route
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={trackingView === "map"}
                  onClick={() => setTrackingView("map")}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors ${trackingView === "map" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <Map size={16} /> Map
                </button>
              </div>
            </div>

            {trackingView === "map" ? (
              <div className="h-[55vh] min-h-[360px]">
                <MapView
                  location={data}
                  stops={routeStops}
                  route={routeStops}
                  selectedStopId={selected?._id}
                />
              </div>
            ) : stops.length ? (
              <div className="p-3 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${status === "active" && !stale ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {connection === "connected" ? <Wifi size={17} /> : <WifiOff size={17} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {stopLocationUnavailable
                          ? "Stop location unavailable"
                          : isStopped
                            ? stoppedMessage
                            : nextStop
                              ? `Next: ${nextStop.label}`
                              : data
                                ? "Live GPS received"
                                : "Waiting for bus GPS"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {stopLocationUnavailable
                          ? "Add valid latitude/longitude stops and attach them to this route."
                          : nextEta?.minutes != null
                            ? `Arrives in about ${nextEta.minutes} min`
                            : nextStop?.time
                              ? `Scheduled for ${nextStop.time}`
                              : connection === "connected"
                                ? "Live connection · awaiting route position"
                                : "Reconnecting to live bus"}
                      </p>
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
                  <div className="absolute bottom-10 left-[21px] top-10 w-0.5 bg-slate-200" />
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
                    const stopEta = stop._id ? data?.etaByStop?.[stop._id] : null;
                    const isSelected = selected?.key === stop.key;

                    return (
                      <div key={stop.key} role="listitem" className="relative h-20">
                        <button
                          type="button"
                          onClick={() => setSelectedStopId(stop.key)}
                          aria-current={isNext ? "step" : undefined}
                          className={`flex h-full w-full items-center gap-3 rounded-xl px-2 text-left transition-colors sm:px-3 ${isNext ? "bg-blue-50" : isSelected ? "bg-slate-50" : "hover:bg-slate-50"}`}
                        >
                          <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white shadow-sm">
                            {isComplete ? (
                              <span className="h-3 w-3 rounded-full bg-emerald-500" />
                            ) : isNext ? (
                              <span className="h-3.5 w-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                            ) : (
                              <span className="h-3 w-3 rounded-full bg-slate-300" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm ${isNext ? "font-black text-blue-950" : isComplete ? "font-semibold text-slate-500" : "font-semibold text-slate-800"}`}>
                              {stop.label}
                            </span>
                            <span className={`mt-0.5 block text-xs ${isNext ? "font-bold text-blue-700" : "text-slate-400"}`}>
                              {isComplete ? "Passed" : isNext ? "Approaching" : `Stop ${index + 1}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            {stopEta?.minutes != null ? (
                              <>
                                <span className={`block text-sm font-black tabular-nums ${isNext ? "text-blue-700" : "text-slate-700"}`}>
                                  ~{stopEta.minutes} min
                                </span>
                                {stopEta.arrival && (
                                  <span className="block text-xs text-slate-400">{fmtTime(stopEta.arrival)}</span>
                                )}
                              </>
                            ) : stopLocationUnavailable ? (
                              <>
                                {stop.time && (
                                  <span className="block text-sm font-bold tabular-nums text-slate-700">
                                    {stop.time}
                                  </span>
                                )}
                                <span className="text-xs font-semibold text-amber-700">
                                  Stop location unavailable
                                </span>
                              </>
                            ) : stop.time ? (
                              <>
                                <span className="block text-sm font-bold tabular-nums text-slate-700">{stop.time}</span>
                                <span className="block text-xs text-slate-400">Scheduled</span>
                              </>
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
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-slate-400">Tracking bus</p>
                  <h2 className="mt-1 truncate text-xl font-black">{bus?.busNumber || "—"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{route?.name || "No route assigned"}</p>
                </div>
                <StatusBadge status={status} />
              </div>
              <dl className="mt-5 divide-y divide-slate-100 text-sm">
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-slate-500">Current stop</dt>
                  <dd className="max-w-[60%] text-right font-semibold">
                    {currentStop?.name || (isStopped ? stoppedMessage : "Between stops")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-slate-500"><Navigation size={15} /> Distance to next stop</dt>
                  <dd className={`text-right font-bold ${stopLocationUnavailable ? "max-w-36 text-xs text-amber-700" : "tabular-nums"}`}>{distanceDisplay}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-slate-500"><Clock3 size={15} /> ETA</dt>
                  <dd className={`text-right font-bold ${stopLocationUnavailable ? "max-w-36 text-xs text-amber-700" : "tabular-nums"}`}>{etaDisplay}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-slate-500"><Gauge size={15} /> Speed</dt>
                  <dd className="font-bold tabular-nums">{data?.speed != null ? `${Math.round(data.speed)} km/h` : "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-slate-500">Last updated</dt>
                  <dd className="font-semibold">{ageSeconds != null ? `${ageSeconds}s ago` : "Waiting for GPS"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-slate-500">Connection</dt>
                  <dd className={connection === "connected" ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                    {connection === "connected" ? "Live" : "Reconnecting"}
                  </dd>
                </div>
              </dl>
              {data?.latitude != null && data?.longitude != null && (
                <p className="border-t border-slate-100 pt-3 text-xs tabular-nums text-slate-400">
                  GPS {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-800">
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
                className="mt-3 text-sm font-bold text-blue-700 hover:text-blue-900"
              >
                Enable alerts
              </button>
              {selected && (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Selected stop: <strong className="text-slate-700">{selected.label}</strong>
                  {eta?.minutes != null && ` · ~${eta.minutes} min`}
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
