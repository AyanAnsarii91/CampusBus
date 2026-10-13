import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import DriverTrip from "./pages/DriverTrip";
import Simulator from "./pages/Simulator";
import {
  AdminDashboard,
  AdminBuses,
  AdminRoutes,
  AdminStops,
  AdminUsers,
  AdminTrips,
  StudentBuses,
  StudentRoutes,
  Profile,
  DriverDashboard,
} from "./pages/SimplePages";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import OfflineIndicator from "./components/OfflineIndicator";

export default function App() {
  return (
    <>
      <OfflineIndicator />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute roles={["student"]} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/buses" element={<StudentBuses />} />
          <Route path="/student/routes" element={<StudentRoutes />} />
          <Route path="/student/profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute roles={["driver"]} />}>
          <Route path="/driver/dashboard" element={<DriverDashboard />} />
          <Route path="/driver/trip" element={<DriverTrip />} />
          <Route path="/driver/profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/buses" element={<AdminBuses />} />
          <Route path="/admin/routes" element={<AdminRoutes />} />
          <Route path="/admin/stops" element={<AdminStops />} />
          <Route
            path="/admin/drivers"
            element={<AdminUsers role="driver" title="Drivers" />}
          />
          <Route
            path="/admin/students"
            element={<AdminUsers role="student" title="Students" />}
          />
          <Route path="/admin/trips" element={<AdminTrips />} />
          <Route path="/admin/simulator" element={<Simulator />} />
          <Route path="/admin/profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute roles={["student", "driver", "admin"]} />}>
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
      <PwaInstallPrompt />
    </>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide text-slate-300">Loading CampusBus…</p>
        </div>
      </div>
    );
  }
  if (user) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }
  return <Navigate to="/login" replace />;
}

