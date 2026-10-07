import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  BusFront,
  LayoutDashboard,
  MapPinned,
  Route as RouteIcon,
  Users,
  LogOut,
  Settings,
  CircleUserRound,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav =
    user?.role === "student"
      ? [
          ["/student/dashboard", "Dashboard", LayoutDashboard],
          ["/student/buses", "Buses", BusFront],
          ["/student/routes", "Routes", RouteIcon],
          ["/student/profile", "Profile", CircleUserRound],
        ]
      : user?.role === "driver"
        ? [
            ["/driver/dashboard", "Dashboard", LayoutDashboard],
            ["/driver/trip", "Trip", MapPinned],
          ]
        : [
            ["/admin/dashboard", "Dashboard", LayoutDashboard],
            ["/admin/buses", "Buses", BusFront],
            ["/admin/routes", "Routes", RouteIcon],
            ["/admin/stops", "Stops", MapPinned],
            ["/admin/drivers", "Drivers", Users],
            ["/admin/students", "Students", Users],
            ["/admin/trips", "Trips", MapPinned],
            ["/admin/simulator", "Simulator", Settings],
          ];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            to={`/${user.role}/dashboard`}
            className="flex items-center gap-2 font-black tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">
              <BusFront size={20} />
            </span>
            <span>
              Campus<span className="text-blue-600">Bus</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold capitalize sm:block">
              {user.role}
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5 sm:px-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-21 space-y-1">
            {nav.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white hover:text-slate-900"}`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-20">{children}</main>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 p-2 backdrop-blur md:hidden">
        {nav.slice(0, 4).map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold ${isActive ? "text-blue-600" : "text-slate-500"}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
