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
import { InstallPwaButton } from "./PwaInstallPrompt";
import ThemeToggle from "./ThemeToggle";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const profilePath = `/${user?.role || "student"}/profile`;

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
            ["/driver/profile", "Profile", CircleUserRound],
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
            ["/admin/profile", "Profile", CircleUserRound],
          ];

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            to={`/${user?.role || "student"}/dashboard`}
            className="flex items-center gap-2 font-black tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 dark:bg-blue-600 text-white shadow-sm">
              <BusFront size={20} />
            </span>
            <span>
              Campus<span className="text-blue-600 dark:text-blue-400">Bus</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <InstallPwaButton variant="header" />
            <ThemeToggle />

            {/* Profile Avatar Button */}
            <Link
              to={profilePath}
              className="flex items-center gap-2 rounded-xl p-1 sm:px-2.5 sm:py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              title="View your profile"
            >
              <div className="relative h-8 w-8 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xs">
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.name || "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-bold text-white">
                    {getInitials(user?.name)}
                  </div>
                )}
              </div>
              <div className="hidden text-left sm:block">
                <p className="max-w-[120px] truncate text-xs font-bold leading-tight text-slate-900 dark:text-white">
                  {user?.name || "Account"}
                </p>
                <p className="text-[10px] capitalize text-slate-500 dark:text-slate-400">
                  {user?.role}
                </p>
              </div>
            </Link>

            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              title="Logout"
              aria-label="Logout"
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
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 dark:bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
                  }`
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

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-2 backdrop-blur md:hidden">
        {nav.slice(0, 5).map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`
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
