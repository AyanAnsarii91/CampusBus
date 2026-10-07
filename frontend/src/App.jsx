import { Navigate, Route, Routes } from "react-router-dom";
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
export default function App() {
  return (
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
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
