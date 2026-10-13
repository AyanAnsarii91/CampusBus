import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import AdminTable from "../components/AdminTable";
import { busApi, routeApi, stopApi, tripApi, userApi } from "../services/api";
import {
  BusFront,
  MapPinned,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  AlertCircle,
  Clock,
  Pencil,
} from "lucide-react";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
export function AdminDashboard() {
  const [b, setB] = useState([]),
    [t, setT] = useState([]),
    [s, setS] = useState([]),
    [drivers, setDrivers] = useState([]);
  const load = () =>
    Promise.all([
      busApi.list(),
      tripApi.active(),
      stopApi.list(),
      userApi.listDrivers(),
    ]).then(([a, c, d, e]) => {
      setB(a.data.buses);
      setT(c.data.trips);
      setS(d.data.stops);
      setDrivers(e.data.drivers);
    });
  const activeBuses = b.filter((bus) => bus.status === "active").length;
  const onlineBuses = b.filter((bus) => {
    const lastUpdate = bus.lastUpdated || bus.currentLocation?.timestamp;
    return (
      bus.status === "active" &&
      lastUpdate &&
      Date.now() - new Date(lastUpdate).getTime() <= 120000
    );
  }).length;
  useEffect(() => {
    load().catch((error) => console.error("Could not load admin dashboard.", error));
  }, []);
  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-bold text-blue-600">OPERATIONS</p>
          <h1 className="text-3xl font-black">System overview</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total buses"
            value={b.length}
            icon={BusFront}
            tone="blue"
          />
          <StatCard
            label="Active buses"
            value={activeBuses}
            icon={BusFront}
            tone="green"
          />
          <StatCard label="Total drivers" value={drivers.length} icon={Users} />
          <StatCard
            label="Active drivers"
            value={drivers.filter((driver) => driver.isActive).length}
            icon={Users}
            tone="green"
          />
          <StatCard
            label="Active trips"
            value={t.length}
            icon={MapPinned}
            tone="green"
          />
          <StatCard
            label="Buses online"
            value={onlineBuses}
            icon={RefreshCw}
            tone="green"
          />
          <StatCard
            label="Buses offline"
            value={b.length - onlineBuses}
            icon={BusFront}
            tone="amber"
          />
          <StatCard label="Stops" value={s.length} icon={MapPinned} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-black">Active buses</h2>
            <button
              onClick={load}
              className="rounded-xl p-2 hover:bg-slate-100"
            >
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {t.map((x) => (
              <div key={x._id} className="rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-bold">{x.busId?.busNumber || "Bus"}</p>
                    <p className="text-xs text-slate-500">
                      {x.routeId?.name || "Route"}
                    </p>
                  </div>
                  <StatusBadge status="active" />
                </div>
              </div>
            ))}
            {!t.length && (
              <p className="text-sm text-slate-500">No active trips.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
export function AdminBuses() {
  const [b, setB] = useState([]),
    [routes, setRoutes] = useState([]),
    [drivers, setDrivers] = useState([]),
    [driverAssignments, setDriverAssignments] = useState({}),
    [routeAssignments, setRouteAssignments] = useState({}),
    [savingBusId, setSavingBusId] = useState(""),
    [assignmentError, setAssignmentError] = useState(""),
    [busError, setBusError] = useState(""),
    [form, setForm] = useState({
      busNumber: "",
      registrationNumber: "",
      routeId: "",
      driverId: "",
    });

  const load = () =>
    Promise.all([busApi.list(), routeApi.list(), userApi.list("driver")]).then(
      ([a, c, d]) => {
        setB(a.data.buses);
        setDriverAssignments(
          Object.fromEntries(
            a.data.buses.map((bus) => [
              bus._id,
              typeof bus.driverId === "object"
                ? bus.driverId?._id || ""
                : bus.driverId || "",
            ]),
          ),
        );
        setRouteAssignments(
          Object.fromEntries(
            a.data.buses.map((bus) => [
              bus._id,
              typeof bus.routeId === "object"
                ? bus.routeId?._id || ""
                : bus.routeId || "",
            ]),
          ),
        );
        setRoutes(c.data.routes);
        setDrivers(d.data.users);
      },
    );

  useEffect(() => {
    load().catch((error) => console.error("Could not load buses.", error));
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setBusError("");
    try {
      await busApi.create(form);
      setForm({
        busNumber: "",
        registrationNumber: "",
        routeId: "",
        driverId: "",
      });
      await load();
    } catch (error) {
      setBusError(error.response?.data?.message || "Could not add this bus.");
    }
  };

  const del = async (id) => {
    if (confirm("Delete this bus?")) {
      await busApi.remove(id);
      load();
    }
  };

  const saveBusAssignments = async (id) => {
    setSavingBusId(id);
    setAssignmentError("");
    try {
      await busApi.update(id, {
        routeId: routeAssignments[id] || null,
        driverId: driverAssignments[id] || null,
      });
      await load();
    } catch (error) {
      setAssignmentError(
        error.response?.data?.message || "Could not update the bus assignment.",
      );
    } finally {
      setSavingBusId("");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-black">Buses</h1>
          <p className="text-sm text-slate-500">
            Manage fleet, routes, and driver assignments.
          </p>
        </div>
        <form
          onSubmit={add}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
        >
          <input
            required
            placeholder="Bus number (e.g. Bus 17)"
            value={form.busNumber}
            onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <input
            required
            placeholder="Registration (e.g. MP13)"
            value={form.registrationNumber}
            onChange={(e) =>
              setForm({ ...form, registrationNumber: e.target.value })
            }
            className="rounded-xl border px-3 py-2.5 text-sm"
          />
          <select
            value={form.routeId}
            onChange={(e) => setForm({ ...form, routeId: e.target.value })}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">Select route (optional)</option>
            {routes.map((r) => (
              <option key={r._id} value={r._id}>
                {r.routeNumber ? `[Bus ${r.routeNumber}] ` : ""}
                {r.direction || r.name}
              </option>
            ))}
          </select>
          <select
            value={form.driverId}
            onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            className="rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">Assign driver (optional)</option>
            {drivers
              .filter(
                (driver) => driver.isActive !== false && !driver.assignedBusId,
              )
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
          </select>
          <button className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white md:col-span-4">
            <Plus size={17} />
            Add bus to fleet
          </button>
        </form>
        {busError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {busError}
          </p>
        )}
        {assignmentError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {assignmentError}
          </p>
        )}
        <AdminTable>
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <th className="p-4">Bus</th>
              <th>Registration</th>
              <th>Assigned Route</th>
              <th>Assigned Driver</th>
              <th>Status</th>
              <th>Action</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {b.map((x) => (
              <tr key={x._id} className="border-b last:border-0 hover:bg-slate-50/50">
                <td className="p-4 font-bold text-slate-900">{x.busNumber}</td>
                <td className="font-mono text-sm text-slate-700">{x.registrationNumber}</td>
                <td className="min-w-56 py-2 pr-3">
                  <select
                    value={routeAssignments[x._id] ?? ""}
                    onChange={(e) =>
                      setRouteAssignments({
                        ...routeAssignments,
                        [x._id]: e.target.value,
                      })
                    }
                    aria-label={`Route assigned to ${x.busNumber}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value="">No Route Assigned</option>
                    {routes.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.routeNumber ? `[Bus ${r.routeNumber}] ` : ""}
                        {r.direction || r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="min-w-56 py-2 pr-3">
                  <select
                    value={driverAssignments[x._id] ?? ""}
                    onChange={(e) =>
                      setDriverAssignments({
                        ...driverAssignments,
                        [x._id]: e.target.value,
                      })
                    }
                    aria-label={`Driver assigned to ${x.busNumber}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {drivers
                      .filter((driver) => {
                        const isCurrentDriver =
                          driver._id === driverAssignments[x._id];
                        return (
                          (driver.isActive !== false || isCurrentDriver) &&
                          (!driver.assignedBusId || isCurrentDriver)
                        );
                      })
                      .map((driver) => (
                        <option key={driver._id} value={driver._id}>
                          {driver.name}
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  <StatusBadge status={x.status} />
                </td>
                <td>
                  <button
                    type="button"
                    disabled={savingBusId === x._id}
                    onClick={() => saveBusAssignments(x._id)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingBusId === x._id ? "Saving…" : "Save"}
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => del(x._id)}
                    title="Delete bus"
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!b.length && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-sm text-slate-500">
                  No buses in fleet.
                </td>
              </tr>
            )}
          </tbody>
        </AdminTable>
      </div>
    </Layout>
  );
}

function getTimetableLinkStatus(entry, routeStops) {
  const stops = Array.isArray(routeStops) ? routeStops : [];
  let linkedStop = null;

  // 1. Stable link via stopId
  if (entry.stopId) {
    const targetId =
      typeof entry.stopId === "object"
        ? String(entry.stopId._id || "")
        : String(entry.stopId);
    if (targetId) {
      linkedStop =
        stops.find((s) => String(s._id) === targetId) ||
        (typeof entry.stopId === "object" ? entry.stopId : null);
    }
  }

  // 2. Exact name match fallback
  if (!linkedStop && entry.place) {
    const entryClean = entry.place.trim().toLowerCase();
    linkedStop =
      stops.find(
        (s) => s.name && s.name.trim().toLowerCase() === entryClean,
      ) || null;
  }

  if (!linkedStop) {
    return {
      status: "unlinked",
      stop: null,
      label: "Unlinked Timetable Entry",
    };
  }

  const hasCoords =
    Number.isFinite(linkedStop.latitude) &&
    linkedStop.latitude >= -90 &&
    linkedStop.latitude <= 90 &&
    Number.isFinite(linkedStop.longitude) &&
    linkedStop.longitude >= -180 &&
    linkedStop.longitude <= 180;

  if (hasCoords) {
    return {
      status: "attached",
      stop: linkedStop,
      label: "Attached",
    };
  }

  return {
    status: "awaiting_geocoded",
    stop: linkedStop,
    label: "Awaiting geocoded stop",
  };
}

export function AdminRoutes() {
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routeShift, setRouteShift] = useState({});
  const [stopDrafts, setStopDrafts] = useState({});
  const [eveningStopDrafts, setEveningStopDrafts] = useState({});
  const [timetableDrafts, setTimetableDrafts] = useState({});
  const [eveningTimetableDrafts, setEveningTimetableDrafts] = useState({});
  const [newStopSelection, setNewStopSelection] = useState({});
  const [savingRouteId, setSavingRouteId] = useState("");
  const [savingTimetableRouteId, setSavingTimetableRouteId] = useState("");
  const [routeError, setRouteError] = useState("");
  const [routeSuccess, setRouteSuccess] = useState("");

  // Create Route Form State
  const [newRoute, setNewRoute] = useState({
    name: "",
    routeNumber: "",
    direction: "",
    busRegistration: "",
  });
  const [createDraftStops, setCreateDraftStops] = useState([]);
  const [createStopSelect, setCreateStopSelect] = useState("");

  const load = () =>
    Promise.all([routeApi.list(), stopApi.list(), busApi.list()]).then(
      ([r, s, b]) => {
        const fetchedRoutes = r.data.routes || [];
        setRoutes(fetchedRoutes);
        setStops(s.data.stops || []);
        setBuses(b.data.buses || []);
        setStopDrafts(
          Object.fromEntries(
            fetchedRoutes.map((route) => [
              route._id,
              (route.stops || []).map((stop) =>
                typeof stop === "object" ? stop._id : stop,
              ),
            ]),
          ),
        );
        setEveningStopDrafts(
          Object.fromEntries(
            fetchedRoutes.map((route) => [
              route._id,
              (route.eveningStops || []).map((stop) =>
                typeof stop === "object" ? stop._id : stop,
              ),
            ]),
          ),
        );
        setTimetableDrafts(
          Object.fromEntries(
            fetchedRoutes.map((route) => [
              route._id,
              (route.scheduledStops || []).map((stop) => ({
                place: stop.place,
                time: stop.time,
                stopId: typeof stop.stopId === "object" ? stop.stopId?._id : stop.stopId,
              })),
            ]),
          ),
        );
        setEveningTimetableDrafts(
          Object.fromEntries(
            fetchedRoutes.map((route) => [
              route._id,
              (route.eveningScheduledStops || []).map((stop) => ({
                place: stop.place,
                time: stop.time,
                stopId: typeof stop.stopId === "object" ? stop.stopId?._id : stop.stopId,
              })),
            ]),
          ),
        );
      },
    );

  useEffect(() => {
    load().catch((error) => console.error("Could not load routes.", error));
  }, []);

  const addRoute = async (e) => {
    e.preventDefault();
    setRouteError("");
    setRouteSuccess("");
    try {
      await routeApi.create({
        ...newRoute,
        stops: createDraftStops,
      });
      setNewRoute({
        name: "",
        routeNumber: "",
        direction: "",
        busRegistration: "",
      });
      setCreateDraftStops([]);
      setCreateStopSelect("");
      setRouteSuccess("Route created successfully.");
      await load();
    } catch (error) {
      setRouteError(
        error.response?.data?.message || "Could not create this route.",
      );
    }
  };

  const saveRouteStops = async (routeId, isEvening) => {
    setSavingRouteId(routeId);
    setRouteError("");
    setRouteSuccess("");
    try {
      if (isEvening) {
        await routeApi.update(routeId, {
          eveningStops: eveningStopDrafts[routeId] || [],
        });
        setRouteSuccess("Evening return stops order saved successfully.");
      } else {
        await routeApi.update(routeId, {
          stops: stopDrafts[routeId] || [],
        });
        setRouteSuccess("Morning pickup stops order saved successfully.");
      }
      await load();
    } catch (error) {
      setRouteError(
        error.response?.data?.message || "Could not save route stops.",
      );
    } finally {
      setSavingRouteId("");
    }
  };

  const saveRouteTimetable = async (routeId, isEvening) => {
    setSavingTimetableRouteId(routeId);
    setRouteError("");
    setRouteSuccess("");
    try {
      if (isEvening) {
        await routeApi.update(routeId, {
          eveningScheduledStops: eveningTimetableDrafts[routeId] || [],
        });
        setRouteSuccess("Evening timetable & estimated travel intervals saved successfully.");
      } else {
        await routeApi.update(routeId, {
          scheduledStops: timetableDrafts[routeId] || [],
        });
        setRouteSuccess("Morning pickup timetable saved successfully.");
      }
      await load();
    } catch (error) {
      setRouteError(
        error.response?.data?.message || "Could not save timetable.",
      );
    } finally {
      setSavingTimetableRouteId("");
    }
  };

  const del = async (id) => {
    if (confirm("Delete this route?")) {
      await routeApi.remove(id);
      load();
    }
  };

  const moveStopInDraft = (routeId, isEvening, fromIndex, toIndex) => {
    const draftMap = isEvening ? eveningStopDrafts : stopDrafts;
    const setDraftMap = isEvening ? setEveningStopDrafts : setStopDrafts;
    const current = [...(draftMap[routeId] || [])];
    if (toIndex < 0 || toIndex >= current.length) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setDraftMap({ ...draftMap, [routeId]: current });
  };

  const removeStopFromDraft = (routeId, isEvening, index) => {
    const draftMap = isEvening ? eveningStopDrafts : stopDrafts;
    const setDraftMap = isEvening ? setEveningStopDrafts : setStopDrafts;
    const current = [...(draftMap[routeId] || [])];
    current.splice(index, 1);
    setDraftMap({ ...draftMap, [routeId]: current });
  };

  const addStopToDraft = (routeId, isEvening, stopId) => {
    if (!stopId) return;
    const draftMap = isEvening ? eveningStopDrafts : stopDrafts;
    const setDraftMap = isEvening ? setEveningStopDrafts : setStopDrafts;
    const current = draftMap[routeId] || [];
    if (current.includes(stopId)) return;
    setDraftMap({ ...draftMap, [routeId]: [...current, stopId] });
    setNewStopSelection({ ...newStopSelection, [routeId]: "" });
  };

  const resetDraft = (routeId, isEvening) => {
    const route = routes.find((r) => r._id === routeId);
    if (!route) return;
    if (isEvening) {
      setEveningStopDrafts({
        ...eveningStopDrafts,
        [routeId]: (route.eveningStops || []).map((s) =>
          typeof s === "object" ? s._id : s,
        ),
      });
    } else {
      setStopDrafts({
        ...stopDrafts,
        [routeId]: (route.stops || []).map((s) =>
          typeof s === "object" ? s._id : s,
        ),
      });
    }
  };

  const updateTimetableTime = (routeId, isEvening, index, newTime) => {
    if (isEvening) {
      const arr = [...(eveningTimetableDrafts[routeId] || [])];
      if (arr[index]) {
        arr[index] = { ...arr[index], time: newTime };
        setEveningTimetableDrafts({ ...eveningTimetableDrafts, [routeId]: arr });
      }
    } else {
      const arr = [...(timetableDrafts[routeId] || [])];
      if (arr[index]) {
        arr[index] = { ...arr[index], time: newTime };
        setTimetableDrafts({ ...timetableDrafts, [routeId]: arr });
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black">Routes & Schedules</h1>
          <p className="text-sm text-slate-500">
            Manage ordered route stops, morning & evening return timetables, and estimated intervals.
          </p>
        </div>

        {/* Create Route Form with interactive ordered stops */}
        <form
          onSubmit={addRoute}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-900">
              Create New Route
            </h2>
            <span className="text-xs text-slate-500">
              Set route metadata and attach ordered geocoded stops
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              required
              value={newRoute.name}
              onChange={(e) =>
                setNewRoute({ ...newRoute, name: e.target.value })
              }
              placeholder="Route Name (e.g. Dewas Route 02)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={newRoute.routeNumber}
              onChange={(e) =>
                setNewRoute({ ...newRoute, routeNumber: e.target.value })
              }
              placeholder="Route / Bus No. (e.g. 17)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={newRoute.direction}
              onChange={(e) =>
                setNewRoute({ ...newRoute, direction: e.target.value })
              }
              placeholder="Direction (e.g. Dewas Route 02)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <input
              value={newRoute.busRegistration}
              onChange={(e) =>
                setNewRoute({ ...newRoute, busRegistration: e.target.value })
              }
              placeholder="Bus Reg. (e.g. MP13)"
              className="rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          {/* Stops picker for new route */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <p className="text-xs font-bold text-slate-700">
              Attach Ordered Geocoded Stops ({createDraftStops.length} stops added)
            </p>

            {createDraftStops.length > 0 && (
              <div className="space-y-1.5">
                {createDraftStops.map((stopId, idx) => {
                  const stop = stops.find((s) => s._id === stopId);
                  return (
                    <div
                      key={`${stopId}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 font-bold text-white text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {stop?.name || "Unknown stop"}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                          ({stop?.latitude?.toFixed(4)}, {stop?.longitude?.toFixed(4)})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            const arr = [...createDraftStops];
                            const [m] = arr.splice(idx, 1);
                            arr.splice(idx - 1, 0, m);
                            setCreateDraftStops(arr);
                          }}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === createDraftStops.length - 1}
                          onClick={() => {
                            const arr = [...createDraftStops];
                            const [m] = arr.splice(idx, 1);
                            arr.splice(idx + 1, 0, m);
                            setCreateDraftStops(arr);
                          }}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const arr = [...createDraftStops];
                            arr.splice(idx, 1);
                            setCreateDraftStops(arr);
                          }}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={createStopSelect}
                onChange={(e) => setCreateStopSelect(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">Select an existing stop to add in order…</option>
                {stops.map((stop) => {
                  const hasCoords =
                    Number.isFinite(stop.latitude) &&
                    stop.latitude >= -90 &&
                    stop.latitude <= 90 &&
                    Number.isFinite(stop.longitude) &&
                    stop.longitude >= -180 &&
                    stop.longitude <= 180;
                  const isAlreadyIn = createDraftStops.includes(stop._id);

                  return (
                    <option
                      key={stop._id}
                      value={stop._id}
                      disabled={!hasCoords || isAlreadyIn}
                    >
                      {stop.name} {hasCoords ? `(${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)})` : "· No GPS"} {isAlreadyIn ? "— Already added" : ""}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                disabled={!createStopSelect}
                onClick={() => {
                  if (createStopSelect && !createDraftStops.includes(createStopSelect)) {
                    setCreateDraftStops([...createDraftStops, createStopSelect]);
                    setCreateStopSelect("");
                  }
                }}
                className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40"
              >
                <Plus size={14} />
                Add Stop to List
              </button>
            </div>
          </div>

          <button className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white text-sm hover:bg-slate-800">
            <Plus size={16} />
            Create Route
          </button>
        </form>

        {routeError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 border border-red-200"
          >
            {routeError}
          </p>
        )}
        {routeSuccess && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 border border-emerald-200"
          >
            {routeSuccess}
          </p>
        )}

        {/* Route Cards */}
        <div className="space-y-6">
          {routes.map((r) => {
            const isEvening = (routeShift[r._id] || "morning") === "evening";
            const assignedBuses = buses.filter(
              (b) =>
                (typeof b.routeId === "object"
                  ? b.routeId?._id
                  : b.routeId) === r._id,
            );
            const primaryBus = assignedBuses[0];
            const assignedDriverName =
              (primaryBus &&
                typeof primaryBus.driverId === "object" &&
                primaryBus.driverId?.name) ||
              r.driverName ||
              "Unassigned";

            const currentDraft = isEvening
              ? (eveningStopDrafts[r._id] || [])
              : (stopDrafts[r._id] || []);
            const originalStopIds = isEvening
              ? (r.eveningStops || []).map((s) => (typeof s === "object" ? s._id : s))
              : (r.stops || []).map((s) => (typeof s === "object" ? s._id : s));
            const hasUnsavedStopChanges =
              JSON.stringify(currentDraft) !== JSON.stringify(originalStopIds);

            const activeTimetable = isEvening
              ? (eveningTimetableDrafts[r._id] || [])
              : (timetableDrafts[r._id] || []);
            const originalTimetable = isEvening
              ? (r.eveningScheduledStops || []).map((s) => ({
                  place: s.place,
                  time: s.time,
                  stopId: typeof s.stopId === "object" ? s.stopId?._id : s.stopId,
                }))
              : (r.scheduledStops || []).map((s) => ({
                  place: s.place,
                  time: s.time,
                  stopId: typeof s.stopId === "object" ? s.stopId?._id : s.stopId,
                }));
            const hasUnsavedTimetableChanges =
              JSON.stringify(activeTimetable) !== JSON.stringify(originalTimetable);

            return (
              <div
                key={r._id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
              >
                {/* Header with Shift Selector */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-black uppercase text-blue-800">
                        {r.routeNumber ? `Bus No. ${r.routeNumber}` : "Route"}
                      </span>
                      <h2 className="text-xl font-black text-slate-900">
                        {r.direction || r.name}
                      </h2>
                    </div>
                    {r.name && r.direction && r.name !== r.direction && (
                      <p className="mt-0.5 text-xs text-slate-500 font-medium">
                        {r.name}
                      </p>
                    )}
                    {(r.busRegistration || r.effectiveFrom) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {[
                          r.busRegistration && `Bus Reg: ${r.busRegistration}`,
                          r.effectiveFrom && `Effective: ${r.effectiveFrom}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Shift Toggle */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setRouteShift({ ...routeShift, [r._id]: "morning" })
                        }
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          !isEvening
                            ? "bg-white text-amber-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        ☀️ Morning Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRouteShift({ ...routeShift, [r._id]: "evening" })
                        }
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          isEvening
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        🌙 Evening Drop (3:30 PM)
                      </button>
                    </div>

                    <button
                      onClick={() => del(r._id)}
                      title="Delete route"
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Fleet Mapping Hero Banner */}
                <div className="grid gap-3 rounded-xl bg-slate-900 p-4 text-white sm:grid-cols-3">
                  <div className="space-y-1 border-b border-slate-800 pb-2 sm:border-b-0 sm:border-r sm:pb-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      Assigned Fleet Bus
                    </p>
                    <div className="flex items-center gap-2">
                      <BusFront size={18} className="text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-black text-sm text-white truncate">
                          {primaryBus
                            ? `${primaryBus.busNumber} (${primaryBus.registrationNumber})`
                            : "No bus assigned"}
                        </p>
                        {primaryBus && (
                          <div className="mt-0.5">
                            <StatusBadge status={primaryBus.status} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 border-b border-slate-800 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pl-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Assigned Driver
                    </p>
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-black text-sm text-white truncate">
                          {assignedDriverName}
                        </p>
                        {(primaryBus?.driverId?.email || r.driverMobile) && (
                          <p className="text-xs text-slate-400">
                            {r.driverMobile || primaryBus?.driverId?.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 sm:pl-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      {isEvening ? "Evening Stops Summary" : "Morning Stops Summary"}
                    </p>
                    <div className="flex items-center gap-2">
                      <MapPinned size={18} className="text-amber-400 shrink-0" />
                      <div>
                        <p className="font-black text-sm text-white">
                          <span className="text-emerald-300">
                            {isEvening ? (r.eveningStops?.length || 0) : (r.stops?.length || 0)}
                          </span>{" "}
                          geocoded stops
                        </p>
                        <p className="text-xs text-slate-400">
                          {isEvening
                            ? `${r.eveningScheduledStops?.length || 0} evening drop stops`
                            : `${r.scheduledStops?.length || 0} morning pickup stops`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shift Banner */}
                <div className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold border ${
                  isEvening
                    ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                }`}>
                  <span className="uppercase text-[10px] tracking-wider font-extrabold">
                    {isEvening ? "Evening Schedule Mode:" : "Morning Schedule Mode:"}
                  </span>
                  <span>
                    {isEvening
                      ? "College Gate (3:30 PM) → Student Drops order"
                      : "Pickup Stops → College Gate (8:55 AM) arrival order"}
                  </span>
                </div>

                {/* Ordered Geocoded Stops Manager */}
                <div className="mt-1 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">
                        {isEvening ? "Ordered Evening Return Stops" : "Ordered Morning Pickup Stops"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isEvening
                          ? "Bus visits stops in this exact reverse/evening order during return trips."
                          : "Bus visits stops in this exact order during morning pickup trips."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasUnsavedStopChanges && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          Unsaved order changes
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={savingRouteId === r._id || !hasUnsavedStopChanges}
                        onClick={() => saveRouteStops(r._id, isEvening)}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
                      >
                        <Save size={14} />
                        {savingRouteId === r._id
                          ? "Saving…"
                          : isEvening
                            ? "Save Evening Stops"
                            : "Save Morning Stops"}
                      </button>
                      {hasUnsavedStopChanges && (
                        <button
                          type="button"
                          onClick={() => resetDraft(r._id, isEvening)}
                          title="Reset to saved order"
                          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <RotateCcw size={14} />
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* The Ordered Stops List */}
                  {currentDraft.length > 0 ? (
                    <div className="space-y-1.5">
                      {currentDraft.map((stopId, index) => {
                        const stop =
                          stops.find((s) => s._id === stopId) ||
                          (r.stops || []).find((s) => (s._id || s) === stopId) ||
                          (r.eveningStops || []).find((s) => (s._id || s) === stopId);
                        const hasCoords =
                          stop &&
                          Number.isFinite(stop.latitude) &&
                          stop.latitude >= -90 &&
                          stop.latitude <= 90 &&
                          Number.isFinite(stop.longitude) &&
                          stop.longitude >= -180 &&
                          stop.longitude <= 180;

                        return (
                          <div
                            key={`${stopId}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-black text-white text-[11px] ${
                                isEvening ? "bg-indigo-600" : "bg-blue-600"
                              }`}>
                                {index + 1}
                              </span>
                              <span className="font-bold text-slate-900 truncate">
                                {stop?.name || "Unknown Stop"}
                              </span>
                              {hasCoords ? (
                                <span className="hidden sm:inline font-mono text-[11px] text-slate-500">
                                  ({stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)})
                                </span>
                              ) : (
                                <span className="text-[11px] text-red-500 font-semibold">
                                  (Coordinates unavailable)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() =>
                                  moveStopInDraft(r._id, isEvening, index, index - 1)
                                }
                                title="Move Stop Up"
                                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={index === currentDraft.length - 1}
                                onClick={() =>
                                  moveStopInDraft(r._id, isEvening, index, index + 1)
                                }
                                title="Move Stop Down"
                                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  removeStopFromDraft(r._id, isEvening, index)
                                }
                                title="Remove Stop from Route"
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                      No stops attached to this route for {isEvening ? "evening return" : "morning pickup"} yet.
                    </div>
                  )}

                  {/* Add Existing Stop Dropdown & Action */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-200">
                    <select
                      value={newStopSelection[r._id] || ""}
                      onChange={(e) =>
                        setNewStopSelection({
                          ...newStopSelection,
                          [r._id]: e.target.value,
                        })
                      }
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="">
                        Select an existing stop to add to {isEvening ? "evening" : "morning"} route…
                      </option>
                      {stops.map((stop) => {
                        const hasCoords =
                          Number.isFinite(stop.latitude) &&
                          stop.latitude >= -90 &&
                          stop.latitude <= 90 &&
                          Number.isFinite(stop.longitude) &&
                          stop.longitude >= -180 &&
                          stop.longitude <= 180;
                        const isAlreadyIn = currentDraft.includes(stop._id);

                        return (
                          <option
                            key={stop._id}
                            value={stop._id}
                            disabled={isAlreadyIn}
                          >
                            {stop.name}{" "}
                            {hasCoords
                              ? `(${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)})`
                              : "· GPS Pending"}{" "}
                            {isAlreadyIn ? "— Already added" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      disabled={!newStopSelection[r._id]}
                      onClick={() =>
                        addStopToDraft(r._id, isEvening, newStopSelection[r._id])
                      }
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      <Plus size={14} />
                      Add Stop to Route
                    </button>
                  </div>
                </div>

                {/* Scheduled Timetable with Editable Timings */}
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-4 py-2.5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {isEvening ? "Evening Return Timetable" : "Morning Pickup Timetable"} ({activeTimetable.length} stops)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {isEvening
                          ? "Starts from College at 3:30 PM. Edit stop timings and estimated intervals below."
                          : "Starts from origin stop to College at 8:55 AM. Edit stop timings below."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasUnsavedTimetableChanges && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Unsaved time edits
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={savingTimetableRouteId === r._id || !hasUnsavedTimetableChanges}
                        onClick={() => saveRouteTimetable(r._id, isEvening)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 shadow-xs"
                      >
                        <Save size={13} />
                        {savingTimetableRouteId === r._id
                          ? "Saving…"
                          : isEvening
                            ? "Save Evening Timetable & Intervals"
                            : "Save Morning Timetable"}
                      </button>
                    </div>
                  </div>

                  {activeTimetable.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b bg-slate-50 text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="p-2.5">S. No.</th>
                            <th className="p-2.5">Place</th>
                            <th className="p-2.5">Scheduled Time (Editable)</th>
                            <th className="p-2.5">GPS Stop Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTimetable.map((stop, i) => {
                            const linkInfo = getTimetableLinkStatus(
                              stop,
                              isEvening ? (r.eveningStops || []) : (r.stops || []),
                            );

                            return (
                              <tr
                                key={`${stop.place}-${i}`}
                                className="border-b last:border-0 hover:bg-slate-50"
                              >
                                <td className="p-2.5 font-bold text-slate-500">
                                  {i + 1}
                                </td>
                                <td className="p-2.5 font-semibold text-slate-800">
                                  <div>{stop.place}</div>
                                  {linkInfo.stop &&
                                    linkInfo.stop.name &&
                                    linkInfo.stop.name.trim().toLowerCase() !==
                                      stop.place.trim().toLowerCase() && (
                                      <div className="text-[10px] font-normal text-slate-500">
                                        Linked stop: {linkInfo.stop.name}
                                      </div>
                                    )}
                                </td>
                                <td className="p-2.5">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={stop.time}
                                      onChange={(e) =>
                                        updateTimetableTime(r._id, isEvening, i, e.target.value)
                                      }
                                      placeholder="HH:MM"
                                      className="w-24 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-blue-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <span className="text-[11px] text-slate-400 font-medium">
                                      24h
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  {linkInfo.status === "attached" ? (
                                    <span
                                      title={`Linked to ${linkInfo.stop.name}`}
                                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"
                                    >
                                      <Check size={11} /> Attached
                                    </span>
                                  ) : linkInfo.status === "awaiting_geocoded" ? (
                                    <span
                                      title={`Linked to ${linkInfo.stop.name} (GPS coordinates pending)`}
                                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200"
                                    >
                                      <Clock size={11} /> Awaiting geocoded stop
                                    </span>
                                  ) : (
                                    <span
                                      title="No route stop is linked to this timetable entry"
                                      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200"
                                    >
                                      <AlertCircle size={11} /> Unlinked Timetable Entry
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No timetable configured for {isEvening ? "evening return" : "morning pickup"} yet.
                    </div>
                  )}

                  {(r.driverName ||
                    r.busInCharge ||
                    r.instructions?.length > 0) && (
                    <div className="bg-slate-50 p-3 text-xs text-slate-600 border-t border-slate-200 space-y-1">
                      <div className="flex flex-wrap gap-4">
                        {r.driverName && (
                          <p>
                            <strong>Driver:</strong> {r.driverName}{" "}
                            {r.driverMobile ? `(${r.driverMobile})` : ""}
                          </p>
                        )}
                        {r.busInCharge && (
                          <p>
                            <strong>Bus In Charge:</strong> {r.busInCharge}
                          </p>
                        )}
                      </div>
                      {r.instructions?.length > 0 && (
                        <ul className="list-disc pl-4 text-[11px] text-slate-500 space-y-0.5 pt-1">
                          {r.instructions.map((inst, idx) => (
                            <li key={idx}>{inst}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!routes.length && (
            <p className="text-sm text-slate-500">No routes configured.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
export function AdminStops() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [stops, setStops] = useState([]);
  const [buses, setBuses] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    scheduledTime: "",
    sequence: 1,
  });

  const [editingStop, setEditingStop] = useState(null);

  // Load routes and buses on mount
  useEffect(() => {
    Promise.all([routeApi.list(), busApi.list()])
      .then(([r, b]) => {
        const fetchedRoutes = r.data.routes || [];
        setRoutes(fetchedRoutes);
        setBuses(b.data.buses || []);
        if (fetchedRoutes.length > 0) {
          setSelectedRouteId((prev) => prev || fetchedRoutes[0]._id);
        }
      })
      .catch((err) => console.error("Could not load routes.", err));
  }, []);

  // Load stops strictly for selected route
  const loadRouteStops = async (routeId) => {
    if (!routeId) return;
    setLoadingStops(true);
    setError("");
    try {
      const res = await stopApi.list({ routeId });
      const routeStops = res.data.stops || [];
      setStops(routeStops);
      setForm((prev) => ({
        ...prev,
        sequence: routeStops.length + 1,
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load stops for this route.");
    } finally {
      setLoadingStops(false);
    }
  };

  useEffect(() => {
    if (selectedRouteId) {
      loadRouteStops(selectedRouteId);
    }
  }, [selectedRouteId]);

  const handleRouteChange = (newRouteId) => {
    setSelectedRouteId(newRouteId);
    setError("");
    setSuccess("");
    setEditingStop(null);
    setForm({
      name: "",
      latitude: "",
      longitude: "",
      scheduledTime: "",
      sequence: 1,
    });
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedRouteId) {
      setError("Please select a route first.");
      return;
    }

    try {
      const latitude =
        form.latitude !== "" && form.latitude !== null
          ? Number(form.latitude)
          : null;
      const longitude =
        form.longitude !== "" && form.longitude !== null
          ? Number(form.longitude)
          : null;

      if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
        throw new Error("Latitude must be a valid number between -90 and 90.");
      }
      if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
        throw new Error("Longitude must be a valid number between -180 and 180.");
      }

      await stopApi.create({
        routeId: selectedRouteId,
        name: form.name.trim(),
        latitude,
        longitude,
        scheduledTime: form.scheduledTime.trim(),
        sequence: Number(form.sequence) || stops.length + 1,
      });

      setSuccess(`Stop "${form.name}" added to route successfully.`);
      setForm({
        name: "",
        latitude: "",
        longitude: "",
        scheduledTime: "",
        sequence: stops.length + 2,
      });
      await loadRouteStops(selectedRouteId);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not add stop.");
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingStop) return;
    setError("");
    setSuccess("");

    try {
      const latitude =
        editingStop.latitude !== "" && editingStop.latitude !== null
          ? Number(editingStop.latitude)
          : null;
      const longitude =
        editingStop.longitude !== "" && editingStop.longitude !== null
          ? Number(editingStop.longitude)
          : null;

      if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
        throw new Error("Latitude must be a valid number between -90 and 90.");
      }
      if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
        throw new Error("Longitude must be a valid number between -180 and 180.");
      }

      await stopApi.update(editingStop._id, {
        name: editingStop.name.trim(),
        latitude,
        longitude,
        scheduledTime: editingStop.scheduledTime ? editingStop.scheduledTime.trim() : "",
        sequence: Number(editingStop.sequence) || 1,
      });

      setSuccess(`Stop "${editingStop.name}" updated.`);
      setEditingStop(null);
      await loadRouteStops(selectedRouteId);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not update stop.");
    }
  };

  const handleDeleteStop = async (stopId, stopName) => {
    if (!confirm(`Delete stop "${stopName}" from this route? This will not affect other routes.`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await stopApi.remove(stopId);
      setSuccess(`Stop "${stopName}" deleted from route.`);
      await loadRouteStops(selectedRouteId);
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete stop.");
    }
  };

  const handleMoveStop = async (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= stops.length) return;
    setError("");
    setSuccess("");
    const newStops = [...stops];
    const [moved] = newStops.splice(fromIndex, 1);
    newStops.splice(toIndex, 0, moved);

    // Optimistic UI update
    setStops(newStops);

    try {
      const stopIds = newStops.map((s) => s._id);
      await stopApi.reorder({ routeId: selectedRouteId, stopIds });
      await loadRouteStops(selectedRouteId);
      setSuccess("Stop order updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not reorder stops.");
      await loadRouteStops(selectedRouteId);
    }
  };

  const currentRoute = routes.find((r) => r._id === selectedRouteId);
  const assignedBus = buses.find(
    (b) => (typeof b.routeId === "object" ? b.routeId?._id : b.routeId) === selectedRouteId,
  );
  const geocodedCount = stops.filter(
    (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
  ).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black">Route Stops Management</h1>
          <p className="text-sm text-slate-500">
            Manage route-specific stops, GPS coordinates, arrival times, and stop ordering with full route isolation.
          </p>
        </div>

        {/* Route Selector Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="routeSelect" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Route
              </label>
              <h2 className="text-lg font-black text-slate-900">
                Select Route to Manage
              </h2>
            </div>
            <div className="sm:w-80">
              <select
                id="routeSelect"
                value={selectedRouteId}
                onChange={(e) => handleRouteChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-xs focus:border-blue-600 focus:outline-none"
              >
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.routeNumber ? `[Bus ${r.routeNumber}] ` : ""}
                    {r.direction || r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Route Info Banner */}
          {currentRoute && (
            <div className="grid gap-3 rounded-xl bg-slate-900 p-4 text-white sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  Route
                </p>
                <p className="text-sm font-black text-white truncate">
                  {currentRoute.direction || currentRoute.name}
                </p>
                {currentRoute.routeNumber && (
                  <p className="text-xs text-slate-400">Route No. {currentRoute.routeNumber}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Assigned Bus
                </p>
                <p className="text-sm font-black text-white truncate">
                  {assignedBus
                    ? `${assignedBus.busNumber} (${assignedBus.registrationNumber})`
                    : "No bus assigned"}
                </p>
                {currentRoute.busRegistration && (
                  <p className="text-xs text-slate-400">Reg: {currentRoute.busRegistration}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Stops on Route
                </p>
                <p className="text-sm font-black text-white">
                  {stops.length} route stops
                </p>
                <p className="text-xs text-slate-400">Isolated to this route</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                  GPS Coordinates Status
                </p>
                <p className="text-sm font-black text-white">
                  <span className="text-emerald-400">{geocodedCount}</span> / {stops.length} with GPS
                </p>
                <p className="text-xs text-slate-400">
                  {stops.length - geocodedCount} pending coordinates
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Add Stop Form for Selected Route */}
        {currentRoute && (
          <form
            onSubmit={handleAddStop}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Add Stop to {currentRoute.direction || currentRoute.name}
                </h3>
                <p className="text-xs text-slate-500">
                  This stop will belong exclusively to this route. Coordinates are optional and can be added later.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1 lg:col-span-2">
                <label className="text-xs font-bold text-slate-600">
                  Stop Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. Aawas Nagar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">
                  Scheduled Time (Optional)
                </label>
                <input
                  placeholder="e.g. 06:40"
                  value={form.scheduledTime}
                  onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">
                  Latitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  placeholder="e.g. 22.949167"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">
                  Longitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  placeholder="e.g. 76.034472"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500">
                Stop will be appended at position #{stops.length + 1}. You can reorder stops at any time.
              </span>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 shadow-sm"
              >
                <Plus size={16} />
                Add Stop to Route
              </button>
            </div>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 border border-red-200"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 border border-emerald-200"
          >
            {success}
          </p>
        )}

        {/* Route Stops Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Stops on {currentRoute ? currentRoute.direction || currentRoute.name : "Selected Route"}
              </h3>
              <p className="text-xs text-slate-500">
                Showing only stops belonging to this route in their exact sequential order.
              </p>
            </div>
            <button
              onClick={() => loadRouteStops(selectedRouteId)}
              title="Refresh stops"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>

          {loadingStops ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading stops…</p>
          ) : (
            <AdminTable>
              <thead>
                <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="p-3.5 text-left w-14"># Order</th>
                  <th className="p-3.5 text-left">Stop Name</th>
                  <th className="p-3.5 text-left">Scheduled Time</th>
                  <th className="p-3.5 text-left">GPS Coordinates</th>
                  <th className="p-3.5 text-center w-24">Reorder</th>
                  <th className="p-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s, index) => {
                  const hasCoords =
                    Number.isFinite(s.latitude) &&
                    s.latitude >= -90 &&
                    s.latitude <= 90 &&
                    Number.isFinite(s.longitude) &&
                    s.longitude >= -180 &&
                    s.longitude <= 180;

                  return (
                    <tr
                      key={s._id}
                      className="border-b last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="p-3.5">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {s.name}
                      </td>
                      <td className="p-3.5 font-mono text-xs">
                        {s.scheduledTime ? (
                          <span className="inline-flex items-center gap-1 font-bold text-blue-700">
                            <Clock size={12} />
                            {s.scheduledTime}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-xs">
                        {hasCoords ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-mono font-medium text-emerald-700 border border-emerald-200">
                            <Check size={12} />
                            {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                            <AlertCircle size={12} />
                            Coordinates Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveStop(index, index - 1)}
                            title="Move Stop Up"
                            className="rounded p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-25"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === stops.length - 1}
                            onClick={() => handleMoveStop(index, index + 1)}
                            title="Move Stop Down"
                            className="rounded p-1 text-slate-600 hover:bg-slate-200 disabled:opacity-25"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingStop({
                                _id: s._id,
                                name: s.name,
                                latitude: s.latitude != null ? s.latitude : "",
                                longitude: s.longitude != null ? s.longitude : "",
                                scheduledTime: s.scheduledTime || "",
                                sequence: s.sequence || index + 1,
                              })
                            }
                            title="Edit stop"
                            className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStop(s._id, s.name)}
                            title="Delete stop from this route"
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!stops.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                      No stops configured for this route yet. Add the first stop above.
                    </td>
                  </tr>
                )}
              </tbody>
            </AdminTable>
          )}
        </div>

        {/* Edit Stop Modal */}
        {editingStop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-black text-slate-900">
                  Edit Stop
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingStop(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Stop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={editingStop.name}
                    onChange={(e) =>
                      setEditingStop({ ...editingStop, name: e.target.value })
                    }
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Scheduled Arrival Time
                  </label>
                  <input
                    placeholder="e.g. 06:40"
                    value={editingStop.scheduledTime}
                    onChange={(e) =>
                      setEditingStop({
                        ...editingStop,
                        scheduledTime: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Latitude (Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      placeholder="e.g. 22.9491"
                      value={editingStop.latitude}
                      onChange={(e) =>
                        setEditingStop({
                          ...editingStop,
                          latitude: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Longitude (Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      placeholder="e.g. 76.0344"
                      value={editingStop.longitude}
                      onChange={(e) =>
                        setEditingStop({
                          ...editingStop,
                          longitude: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setEditingStop(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
export function AdminTrips() {
  const [trips, setTrips] = useState([]);
  useEffect(() => {
    tripApi.active().then((r) => setTrips(r.data.trips));
  }, []);
  return (
    <Layout>
      <div className="space-y-5">
        <h1 className="text-3xl font-black">Active trips</h1>
        {trips.map((t) => (
          <div
            key={t._id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black">{t.busId?.busNumber}</p>
                <p className="text-sm text-slate-500">{t.routeId?.name}</p>
              </div>
              <StatusBadge status="active" />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Started {new Date(t.startedAt).toLocaleString()}
            </p>
          </div>
        ))}
        {!trips.length && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
            No active trips.
          </div>
        )}
      </div>
    </Layout>
  );
}
