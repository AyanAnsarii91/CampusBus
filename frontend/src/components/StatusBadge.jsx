export default function StatusBadge({ status, label: customLabel }) {
  const s = (status || "offline").toLowerCase();
  const map = {
    active: ["Live", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
    online: ["Live", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
    "on route": ["On Route", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
    stopped: ["Stopped", "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"],
    delayed: ["Location Update Delayed", "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"],
    stale: ["Location Update Delayed", "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"],
    no_active_trip: ["No Active Trip", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"],
    "no active trip": ["No Active Trip", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"],
    completed: ["Trip Completed", "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"],
    "trip completed": ["Trip Completed", "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"],
    trip_ended: ["Trip Ended", "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"],
    "trip ended": ["Trip Ended", "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"],
    final_stop_reached: ["Final Stop Reached", "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"],
    "final stop reached": ["Final Stop Reached", "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"],
    live_unavailable: ["Live location unavailable", "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"],
    offline: ["No Active Trip", "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"],
  };
  const [defaultLabel, cls] = map[s] || [status, "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"];
  const label = customLabel || defaultLabel;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
