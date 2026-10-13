import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { MapPin, Navigation, Radio, Square, TriangleAlert } from "lucide-react";
import Layout from "../components/Layout";
import { SOCKET_URL, authApi, busApi, routeApi, tripApi } from "../services/api";
import { auth } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import MapView from "../components/MapView";

function connectTripLocation({
  bus,
  trip,
  token,
  socketRef,
  watchRef,
  setPos,
  setGpsError,
  hasLoggedGpsFix,
}) {
  if (socketRef.current) {
    socketRef.current.disconnect();
    socketRef.current = null;
  }
  if (watchRef.current) {
    navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  const getLatestCleanToken = () => {
    let t =
      localStorage.getItem("campusbus_token") ||
      sessionStorage.getItem("campusbus_token") ||
      token ||
      "";
    if (typeof t === "string" && t.startsWith("Bearer ")) {
      t = t.slice(7).trim();
    }
    return t;
  };

  const connection = io(SOCKET_URL, {
    auth: (cb) => {
      cb({ token: getLatestCleanToken() });
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  socketRef.current = connection;

  connection.on("connect", () => {
    console.info("[DriverTrip] Socket.IO connected; requesting browser GPS.");
    setGpsError("");
    if (!navigator.geolocation) {
      const message = "This browser does not support location tracking.";
      console.error("[DriverTrip] Geolocation API is unavailable.");
      setGpsError(message);
      return;
    }
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          busId: bus._id,
          tripId: trip._id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed:
            position.coords.speed == null
              ? null
              : Math.max(0, position.coords.speed * 3.6),
          heading: position.coords.heading,
          timestamp: new Date().toISOString(),
          accuracy: position.coords.accuracy,
        };
        setPos(payload);
        connection.emit("driver:location", payload);
        if (!hasLoggedGpsFix.current) {
          hasLoggedGpsFix.current = true;
          console.info("[DriverTrip] First GPS fix emitted.", {
            tripId: payload.tripId,
            accuracyMeters: payload.accuracy,
            speedKmh: payload.speed,
          });
        }
      },
      (error) => {
        console.error("[DriverTrip] Browser GPS failed.", {
          code: error.code,
          message: error.message,
        });
        setGpsError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
  });
  connection.on("connect_error", async (error) => {
    console.error("[DriverTrip] Socket.IO connection failed.", {
      message: error.message,
    });
    if (error.message === "Invalid token" || error.message === "Authentication required") {
      try {
        const fbUser = auth?.currentUser;
        if (fbUser) {
          const freshIdToken = await fbUser.getIdToken(true);
          const r = await authApi.firebaseLogin({ idToken: freshIdToken });
          if (r.data?.token) {
            localStorage.setItem("campusbus_token", r.data.token);
            connection.auth = { token: r.data.token };
            connection.connect();
            return;
          }
        }
      } catch (refreshErr) {
        console.warn("[DriverTrip] Token refresh on connect_error failed:", refreshErr);
      }
      setGpsError(
        "Driver session has expired. Sign in again to broadcast live location.",
      );
    } else {
      setGpsError(
        "Trip is active, but the live connection failed. Check the API server and try again.",
      );
    }
  });
  connection.on("disconnect", (reason) => {
    console.warn("[DriverTrip] Socket.IO disconnected.", { reason });
  });
  connection.on("location:accepted", (event) => {
    console.debug("[DriverTrip] Backend accepted a GPS update.", event);
  });
  connection.on("location:error", (event) => {
    console.error("[DriverTrip] Backend rejected a GPS update.", event);
    setGpsError(event.message || "The backend rejected the GPS update.");
  });
  return connection;
}

export default function DriverTrip() {
  const { user } = useAuth();
  const [bus, setBus] = useState(null);
  const [route, setRoute] = useState(null);
  const [trip, setTrip] = useState(null);
  const [shift, setShift] = useState(() =>
    new Date().getHours() >= 13 ? "evening" : "morning"
  );
  const [tripLoading, setTripLoading] = useState(true);
  const [pos, setPos] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const socket = useRef(null);
  const watch = useRef(null);
  const tripAuthConfig = useRef(null);
  const hasLoggedGpsFix = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const loadDriverTrip = async () => {
      try {
        const response = await busApi.list();
        const driverId = user.id || user._id;
        const assignedBus = response.data.buses.find((item) => {
          const assignedDriverId =
            typeof item.driverId === "object" ? item.driverId?._id : item.driverId;
          return assignedDriverId === driverId;
        });
        if (cancelled) return;
        setBus(assignedBus || null);
        if (!assignedBus) {
          console.error("[DriverTrip] No bus is assigned to this driver.", {
            driverId,
          });
          setGpsError("No bus is assigned to your account. Contact an administrator.");
          return;
        }
        console.info("[DriverTrip] Assigned bus loaded.", {
          busId: assignedBus._id,
          busNumber: assignedBus.busNumber,
        });
        const routeId =
          typeof assignedBus.routeId === "string"
            ? assignedBus.routeId
            : assignedBus.routeId?._id;
        const [routeResponse, activeTripsResponse] = await Promise.all([
          routeId ? routeApi.get(routeId) : Promise.resolve(null),
          tripApi.active(),
        ]);
        if (cancelled) return;
        setRoute(routeResponse?.data.route || null);

        const activeTrip = activeTripsResponse.data.trips.find((item) => {
          const tripDriverId =
            typeof item.driverId === "object" ? item.driverId?._id : item.driverId;
          const tripBusId =
            typeof item.busId === "object" ? item.busId?._id : item.busId;
          return (
            item.status === "active" &&
            String(tripDriverId) === String(driverId) &&
            String(tripBusId) === String(assignedBus._id)
          );
        });
        if (activeTrip) {
          if (activeTrip.shift) setShift(activeTrip.shift);
          const token =
            localStorage.getItem("campusbus_token") ||
            sessionStorage.getItem("campusbus_token");
          setTrip(activeTrip);
          setPos(assignedBus.currentLocation || null);
          console.info("[DriverTrip] Restored active trip after page load.", {
            tripId: activeTrip._id,
            busId: assignedBus._id,
            shift: activeTrip.shift,
          });
          if (token) {
            tripAuthConfig.current = {
              headers: { Authorization: `Bearer ${token}` },
            };
            socket.current = connectTripLocation({
              bus: assignedBus,
              trip: activeTrip,
              token,
              socketRef: socket,
              watchRef: watch,
              setPos,
              setGpsError,
              hasLoggedGpsFix,
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[DriverTrip] Failed to load assigned bus or active trip.", {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
          setGpsError(
            error.response?.data?.message || "Could not load your assigned bus and trip.",
          );
        }
      } finally {
        if (!cancelled) setTripLoading(false);
      }
    };
    loadDriverTrip();
    return () => {
      cancelled = true;
      if (watch.current) navigator.geolocation.clearWatch(watch.current);
      socket.current?.disconnect();
    };
  }, [user]);
  const start = async () => {
    setGpsError("");
    hasLoggedGpsFix.current = false;
    if (!bus) {
      console.error("[DriverTrip] Trip start blocked: no assigned bus is loaded.");
      setGpsError("No bus is assigned to your account. Contact an administrator.");
      return;
    }
    console.info("[DriverTrip] Requesting trip start.", {
      busId: bus._id,
      busNumber: bus.busNumber,
      shift,
    });
    const token =
      localStorage.getItem("campusbus_token") ||
      sessionStorage.getItem("campusbus_token");
    if (!token) {
      setGpsError("Your driver session has expired. Sign in again to start a trip.");
      return;
    }
    const authConfig = {
      headers: { Authorization: `Bearer ${token}` },
    };
    try {
      const r = await tripApi.start({ busId: bus._id, shift }, authConfig);
      tripAuthConfig.current = authConfig;
      setTrip(r.data.trip);
      if (r.data.trip?.shift) setShift(r.data.trip.shift);
      console.info("[DriverTrip] Trip created.", {
        tripId: r.data.trip._id,
        busId: r.data.trip.busId,
        routeId: r.data.trip.routeId,
        shift: r.data.trip.shift,
      });
      socket.current = connectTripLocation({
        bus,
        trip: r.data.trip,
        token,
        socketRef: socket,
        watchRef: watch,
        setPos,
        setGpsError,
        hasLoggedGpsFix,
      });
    } catch (e) {
      console.error("[DriverTrip] Trip start request failed.", {
        status: e.response?.status,
        message: e.response?.data?.message || e.message,
      });
      if (
        e.response?.status === 409 &&
        typeof e.response?.data?.message === "string" &&
        e.response.data.message.includes("already has an active trip")
      ) {
        try {
          const activeTripsResponse = await tripApi.active();
          const driverId = user.id || user._id;
          const existingTrip = activeTripsResponse.data.trips.find((item) => {
            const tripDriverId =
              typeof item.driverId === "object" ? item.driverId?._id : item.driverId;
            const tripBusId =
              typeof item.busId === "object" ? item.busId?._id : item.busId;
            return (
              item.status === "active" &&
              String(tripDriverId) === String(driverId) &&
              String(tripBusId) === String(bus._id)
            );
          });
          if (existingTrip) {
            setTrip(existingTrip);
            if (existingTrip.shift) setShift(existingTrip.shift);
            socket.current = connectTripLocation({
              bus,
              trip: existingTrip,
              token,
              socketRef: socket,
              watchRef: watch,
              setPos,
              setGpsError,
              hasLoggedGpsFix,
            });
            return;
          }
        } catch (recoverErr) {
          console.warn("[DriverTrip] Active trip recovery error:", recoverErr);
        }
      }
      setGpsError(e.response?.data?.message || "Could not start trip");
    }
  };
  const stop = async () => {
    try {
      if (trip) {
        console.info("[DriverTrip] Requesting trip stop.", { tripId: trip._id });
        await tripApi.stop(
          { tripId: trip._id },
          tripAuthConfig.current || undefined,
        );
        setTrip(null);
        tripAuthConfig.current = null;
      }
    } catch (error) {
      console.error("[DriverTrip] Trip stop request failed.", {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });
      setGpsError(error.response?.data?.message || "Could not stop trip.");
      return;
    }
    if (watch.current) navigator.geolocation.clearWatch(watch.current);
    socket.current?.disconnect();
    setPos(null);
  };
  const currentShift = trip?.shift || shift;
  const displayStops =
    currentShift === "evening" && route?.eveningStops?.length
      ? route.eveningStops
      : route?.stops || [];

  const completedStopIds = new Set(
    (trip?.stopArrivals || []).map((a) => String(a.stopId || a.stopName))
  );
  const nextStop =
    displayStops.find(
      (s) => !completedStopIds.has(String(s._id || s.name))
    ) || displayStops[displayStops.length - 1];

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="text-sm font-bold text-blue-600">DRIVER MODE</p>
          <h1 className="mt-1 text-3xl font-black">
            {bus?.busNumber || "Assigned bus"}
          </h1>
          <p className="text-sm text-slate-500">
            {route?.name || "Loading route…"}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_300px]">
          <div className="h-[55vh] min-h-[400px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <MapView
              location={pos}
              stops={displayStops}
              route={displayStops}
            />
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-sm font-bold">
                <div className="flex items-center gap-2">
                  <Radio
                    size={18}
                    className={
                      trip ? "text-emerald-600 pulse-soft" : "text-slate-400"
                    }
                  />{" "}
                  {trip ? "Trip Active" : "Trip Offline"}
                </div>
                {trip && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${currentShift === "evening"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                      }`}
                  >
                    {currentShift === "evening" ? "🌆 Evening" : "🌅 Morning"}
                  </span>
                )}
              </div>

              {!trip && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Select Trip Shift
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShift("morning")}
                      className={`rounded-lg py-2 text-xs font-bold transition-all ${shift === "morning"
                        ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-300"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      🌅 Morning Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setShift("evening")}
                      className={`rounded-lg py-2 text-xs font-bold transition-all ${shift === "evening"
                        ? "bg-white text-amber-700 shadow-sm ring-1 ring-amber-300"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      🌆 Evening Drop
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs uppercase text-slate-400">GPS</p>
                  <p className="mt-1 font-bold">
                    {pos ? "Connected" : "Waiting"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Speed</p>
                  <p className="mt-1 font-bold">
                    {Math.round(pos?.speed || 0)} km/h
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Next stop</p>
                  <p className="mt-1 font-bold">
                    {nextStop?.name || "—"}
                  </p>
                </div>
              </div>
              {gpsError && (
                <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  <TriangleAlert size={16} />
                  {gpsError}
                </div>
              )}
              {!trip ? (
                <button
                  type="button"
                  disabled={tripLoading || !bus}
                  onClick={start}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <Navigation size={18} />
                  {tripLoading ? "CHECKING TRIP…" : `START ${shift === "evening" ? "EVENING DROP" : "MORNING PICKUP"}`}
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 font-black text-white hover:bg-red-700"
                >
                  <Square size={17} /> STOP TRIP
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
