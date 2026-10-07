import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import Layout from "../components/Layout";
import { routeApi } from "../services/api";
export { AdminDashboard, AdminBuses, AdminRoutes, AdminStops, AdminTrips } from "./AdminOperations";
export { AdminUsers } from "./AdminUsers";
export function StudentBuses() {
  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-black">Buses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Available buses are shown on your dashboard.
        </p>
      </div>
    </Layout>
  );
}
export function StudentRoutes() {
  const [routes, setRoutes] = useState([]);
  useEffect(() => {
    routeApi.list().then((r) => setRoutes(r.data.routes));
  }, []);
  return (
    <Layout>
      <div className="space-y-5">
        <h1 className="text-3xl font-black">Routes</h1>
        {routes.map((route) => (
          <section
            key={route._id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-black">
              {route.routeNumber ? `Bus No. ${route.routeNumber} | ` : ""}
              {route.name}
            </h2>
            {route.direction && (
              <p className="mt-1 text-sm text-slate-500">
                {route.direction} Â· {route.busRegistration} Â· Effective from{" "}
                {route.effectiveFrom}
              </p>
            )}
            {route.scheduledStops?.length > 0 && (
              <>
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
                      {route.scheduledStops.map((stop, i) => (
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
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                  <p>
                    <strong>Driver:</strong> {route.driverName} Â·{" "}
                    {route.driverMobile}
                  </p>
                  <p>
                    <strong>Bus in charge:</strong> {route.busInCharge}
                  </p>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {route.instructions?.map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}
        {!routes.length && (
          <p className="text-sm text-slate-500">No routes available.</p>
        )}
      </div>
    </Layout>
  );
}
export function Profile() {
  const { user } = useAuth();
  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-3xl font-black">Profile</h1>
        <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm space-y-3">
          <p>
            <span className="text-slate-400">Name</span>
            <br />
            <strong>{user.name}</strong>
          </p>
          <p>
            <span className="text-slate-400">Email</span>
            <br />
            <strong>{user.email}</strong>
          </p>
          <p>
            <span className="text-slate-400">Student ID</span>
            <br />
            <strong>{user.studentId || "â€”"}</strong>
          </p>
        </div>
      </div>
    </Layout>
  );
}
export function DriverDashboard() {
  return (
    <Layout>
      <div className="rounded-2xl bg-slate-900 p-7 text-white">
        <p className="text-sm font-bold text-blue-300">DRIVER CONSOLE</p>
        <h1 className="mt-2 text-3xl font-black">Ready to drive?</h1>
        <p className="mt-2 max-w-lg text-slate-300">
          Start a trip from the Trip page. Your device GPS will be streamed to
          students tracking your bus.
        </p>
      </div>
    </Layout>
  );
}
