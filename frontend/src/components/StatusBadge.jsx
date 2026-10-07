export default function StatusBadge({ status }) {
  const s = (status || "offline").toLowerCase();
  const map = {
    active: ["Live", "bg-emerald-50 text-emerald-700"],
    online: ["Live", "bg-emerald-50 text-emerald-700"],
    "on route": ["On Route", "bg-emerald-50 text-emerald-700"],
    stopped: ["Stopped", "bg-amber-50 text-amber-700"],
    delayed: ["Delayed", "bg-orange-50 text-orange-700"],
    offline: ["Offline", "bg-slate-100 text-slate-600"],
    stale: ["Stale", "bg-orange-50 text-orange-700"],
  };
  const [label, cls] = map[s] || [status, "bg-slate-100 text-slate-600"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
