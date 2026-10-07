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
  const assignDriver = async (id) => {
    setSavingBusId(id);
    setAssignmentError("");
    try {
      await busApi.assignDriver(id, driverAssignments[id] || null);
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
            Manage fleet and route assignments.
          </p>
        </div>
        <form
          onSubmit={add}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
        >
          <input
            required
            placeholder="Bus number"
            value={form.busNumber}
            onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          />
          <input
            required
            placeholder="Registration"
            value={form.registrationNumber}
            onChange={(e) =>
              setForm({ ...form, registrationNumber: e.target.value })
            }
            className="rounded-xl border px-3 py-2.5"
          />
          <select
            value={form.routeId}
            onChange={(e) => setForm({ ...form, routeId: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          >
            <option value="">Select route</option>
            {routes.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={form.driverId}
            onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          >
            <option value="">Assign driver</option>
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
          <button className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white">
            <Plus size={17} />
            Add bus
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
              <th>Route</th>
              <th>Driver</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {b.map((x) => (
              <tr key={x._id} className="border-b last:border-0">
                <td className="p-4 font-bold">{x.busNumber}</td>
                <td>{x.registrationNumber}</td>
                <td>
                  {((typeof x.routeId === "object"
                    ? x.routeId?._id
                    : x.routeId) &&
                    routes.find(
                      (r) =>
                        r._id ===
                        (typeof x.routeId === "object"
                          ? x.routeId?._id
                          : x.routeId),
                    )?.name) ||
                    "â€”"}
                </td>
                <td className="min-w-64 py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={driverAssignments[x._id] ?? ""}
                      onChange={(e) =>
                        setDriverAssignments({
                          ...driverAssignments,
                          [x._id]: e.target.value,
                        })
                      }
                      aria-label={`Driver assigned to ${x.busNumber}`}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
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
                    <button
                      type="button"
                      disabled={savingBusId === x._id}
                      onClick={() => assignDriver(x._id)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {savingBusId === x._id ? "Savingâ€¦" : "Save"}
                    </button>
                  </div>
                </td>
                <td>
                  <StatusBadge status={x.status} />
                </td>
                <td>
                  <button
                    onClick={() => del(x._id)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </div>
    </Layout>
  );
}
export function AdminRoutes() {
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const load = () =>
    Promise.all([routeApi.list(), stopApi.list()]).then(([r, s]) => {
      setRoutes(r.data.routes);
      setStops(s.data.stops);
    });
  useEffect(() => {
    load().catch((error) => console.error("Could not load routes.", error));
  }, []);
  const add = async (e) => {
    e.preventDefault();
    await routeApi.create({ name, stops: selected });
    setName("");
    setSelected([]);
    load();
  };
  const del = async (id) => {
    if (confirm("Delete this route?")) {
      await routeApi.remove(id);
      load();
    }
  };
  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-black">Routes</h1>
          <p className="text-sm text-slate-500">
            Create ordered routes from existing stops.
          </p>
        </div>
        <form
          onSubmit={add}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Route name"
              className="flex-1 rounded-xl border px-3 py-2.5"
            />
            <button className="rounded-xl bg-slate-900 px-4 font-bold text-white">
              Add route
            </button>
          </div>
          <select
            multiple
            value={selected}
            onChange={(e) =>
              setSelected([...e.target.selectedOptions].map((o) => o.value))
            }
            className="mt-3 min-h-32 w-full rounded-xl border p-2 text-sm"
          >
            {stops.map((s) => (
              <option key={s._id} value={s._id}>
                {s.sequence}. {s.name}
              </option>
            ))}
          </select>
        </form>
        {routes.map((r) => (
          <div
            key={r._id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black">
                  {r.routeNumber ? `Bus No. ${r.routeNumber} | ` : ""}
                  {r.name}
                </h2>
                {r.direction && (
                  <p className="mt-1 text-sm text-slate-500">
                    {r.direction} Â· {r.busRegistration} Â· Effective from{" "}
                    {r.effectiveFrom}
                  </p>
                )}
              </div>
              <button
                onClick={() => del(r._id)}
                className="rounded-lg p-2 text-red-500 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.stops.map((s, i) => (
                <span
                  key={s._id || i}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                >
                  {i + 1}. {s.name}
                </span>
              ))}
            </div>
            {r.scheduledStops?.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">S. No.</th>
                      <th className="p-3">Place</th>
                      <th className="p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.scheduledStops.map((stop, i) => (
                      <tr
                        key={`${stop.place}-${i}`}
                        className="border-b last:border-0"
                      >
                        <td className="p-3">{i + 1}</td>
                        <td className="p-3 font-medium">{stop.place}</td>
                        <td className="p-3 tabular-nums">{stop.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                  <p>
                    <strong>Driver:</strong> {r.driverName} Â· {r.driverMobile}
                  </p>
                  <p>
                    <strong>Bus in charge:</strong> {r.busInCharge}
                  </p>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {r.instructions?.map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
export function AdminStops() {
  const [stops, setStops] = useState([]);
  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    sequence: 1,
  });
  const load = () => stopApi.list().then((r) => setStops(r.data.stops));
  useEffect(() => {
    load().catch((error) => console.error("Could not load stops.", error));
  }, []);
  const add = async (e) => {
    e.preventDefault();
    await stopApi.create({
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      sequence: Number(form.sequence),
    });
    setForm({ name: "", latitude: "", longitude: "", sequence: 1 });
    load();
  };
  return (
    <Layout>
      <div className="space-y-5">
        <h1 className="text-3xl font-black">Stops</h1>
        <form
          onSubmit={add}
          className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-5"
        >
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          />
          <input
            required
            type="number"
            step="any"
            placeholder="Latitude"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          />
          <input
            required
            type="number"
            step="any"
            placeholder="Longitude"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          />
          <input
            type="number"
            placeholder="Sequence"
            value={form.sequence}
            onChange={(e) => setForm({ ...form, sequence: e.target.value })}
            className="rounded-xl border px-3 py-2.5"
          />
          <button className="rounded-xl bg-slate-900 font-bold text-white">
            Add stop
          </button>
        </form>
        <AdminTable>
          <thead>
            <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <th className="p-4">Name</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Sequence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s) => (
              <tr key={s._id} className="border-b">
                <td className="p-4 font-bold">{s.name}</td>
                <td>{s.latitude}</td>
                <td>{s.longitude}</td>
                <td>{s.sequence}</td>
                <td>
                  <button
                    onClick={async () => {
                      if (confirm("Delete this stop?")) {
                        await stopApi.remove(s._id);
                        load();
                      }
                    }}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
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
