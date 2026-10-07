import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Layout from "../components/Layout";
import { SOCKET_URL, busApi, routeApi } from "../services/api";
import { Play, Pause, Square, Gauge } from "lucide-react";
import MapView from "../components/MapView";
export default function Simulator() {
  const [buses, setBuses] = useState([]),
    [routes, setRoutes] = useState([]),
    [busId, setBusId] = useState(""),
    [speed, setSpeed] = useState(32),
    [running, setRunning] = useState(false),
    [paused, setPaused] = useState(false),
    [pos, setPos] = useState(null),
    trip = useRef(null),
    socket = useRef(null),
    timer = useRef(null),
    idx = useRef(0),
    t = useRef(0);
  useEffect(() => {
    Promise.all([busApi.list(), routeApi.list()]).then(([b, r]) => {
      setBuses(b.data.buses);
      setRoutes(r.data.routes);
      setBusId(b.data.buses[0]?._id || "");
    });
    return () => {
      clearInterval(timer.current);
      socket.current?.disconnect();
    };
  }, []);
  const bus = buses.find((b) => b._id === busId),
    route = routes.find((r) => r._id === bus?.routeId);
  const start = async () => {
    const r = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/simulator/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("campusbus_token")}`,
        },
        body: JSON.stringify({ busId }),
      },
    );
    const data = await r.json();
    trip.current = data.trip;
    socket.current = io(SOCKET_URL, {
      auth: { token: sessionStorage.getItem("campusbus_token") },
    });
    socket.current.on("connect", () => {
      idx.current = 0;
      t.current = 0;
      setRunning(true);
      setPaused(false);
      timer.current = setInterval(step, 3000);
    });
  };
  const step = () => {
    if (paused || !route?.stops?.length || !socket.current?.connected) return;
    const a = route.stops[idx.current],
      b = route.stops[(idx.current + 1) % route.stops.length];
    if (!a || !b) return;
    const total = Math.max(
      1,
      Math.sqrt(
        (b.latitude - a.latitude) ** 2 + (b.longitude - a.longitude) ** 2,
      ),
    );
    const fraction = Math.min(1, t.current / 20);
    const latitude = a.latitude + (b.latitude - a.latitude) * fraction,
      longitude = a.longitude + (b.longitude - a.longitude) * fraction;
    const payload = {
      busId,
      tripId: trip.current._id,
      latitude,
      longitude,
      speed: Number(speed),
      heading: 0,
      timestamp: new Date().toISOString(),
      accuracy: 8,
    };
    setPos(payload);
    socket.current.emit("simulator:location", payload);
    t.current += 3;
    if (fraction >= 1) {
      idx.current = (idx.current + 1) % route.stops.length;
      t.current = 0;
    }
  };
  const stop = async () => {
    clearInterval(timer.current);
    if (trip.current)
      await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/simulator/stop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("campusbus_token")}`,
          },
          body: JSON.stringify({ tripId: trip.current._id }),
        },
      );
    socket.current?.disconnect();
    trip.current = null;
    setRunning(false);
    setPaused(false);
  };
  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-bold text-purple-600">DEVELOPMENT TOOL</p>
          <h1 className="text-3xl font-black">GPS Simulator</h1>
          <p className="text-sm text-slate-500">
            Move a demo bus along its real route without burning petrol.
            Humanity survives another test cycle.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
          <div className="h-[58vh] min-h-[420px] overflow-hidden rounded-2xl border bg-white">
            <MapView
              location={pos}
              stops={route?.stops || []}
              route={route?.stops || []}
            />
          </div>
          <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
            <label className="block text-sm font-bold">
              Bus
              <select
                disabled={running}
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2.5"
              >
                {buses.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.busNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              Speed: {speed} km/h
              <input
                disabled={running}
                type="range"
                min="5"
                max="70"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                className="mt-3 w-full"
              />
            </label>
            <div className="flex gap-2">
              {!running ? (
                <button
                  onClick={start}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-black text-white"
                >
                  <Play size={17} />
                  Start
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setPaused((x) => !x)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-black text-white"
                  >
                    {paused ? <Play size={17} /> : <Pause size={17} />}{" "}
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={stop}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-black text-white"
                  >
                    <Square size={17} />
                    Stop
                  </button>
                </>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex items-center gap-2 font-bold">
                <Gauge size={17} /> Simulation
              </div>
              <p className="mt-2 text-slate-500">
                {running
                  ? "Broadcasting a GPS point every 3 seconds."
                  : "Ready to simulate."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
