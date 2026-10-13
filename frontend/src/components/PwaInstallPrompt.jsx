import { useState } from "react";
import { Download, X, BusFront, Sparkles } from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";

export function InstallPwaButton({ variant = "default", className = "" }) {
  const { canInstall, isInstalled, installApp } = usePwaInstall();
  const [installing, setInstalling] = useState(false);

  if (isInstalled || !canInstall) return null;

  const handleInstall = async () => {
    setInstalling(true);
    await installApp();
    setInstalling(false);
  };

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className={`flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20 active:scale-95 disabled:opacity-50 ${className}`}
        title="Install CampusBus app on this device"
      >
        <Download size={13} className="text-blue-400" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      disabled={installing}
      className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:shadow-blue-500/30 active:scale-95 disabled:opacity-50 ${className}`}
    >
      <Download size={15} />
      <span>Install CampusBus</span>
    </button>
  );
}

export default function PwaInstallPrompt() {
  const { canInstall, isInstalled, installApp, dismissPrompt } = usePwaInstall();
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || !canInstall || dismissed) return null;

  const handleInstall = async () => {
    setInstalling(true);
    await installApp();
    setInstalling(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    dismissPrompt();
  };

  return (
    <div
      role="banner"
      aria-label="Install CampusBus Application"
      className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md animate-fade-in"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/95 p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-24 w-24 rounded-full bg-blue-500/25 blur-xl" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-md shadow-blue-500/30">
              <div className="grid h-full w-full place-items-center rounded-xl bg-slate-950 text-white">
                <BusFront size={20} className="text-blue-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-black text-sm text-white">
                <span>Install CampusBus</span>
                <span className="flex items-center gap-0.5 rounded-full bg-cyan-500/10 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400 border border-cyan-500/20">
                  <Sparkles size={9} /> PWA
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">
                Fast 1-tap home screen launch & offline shell
              </p>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="Dismiss installation banner"
            aria-label="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 flex items-center gap-2 pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 py-2.5 px-3 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            <Download size={14} />
            <span>{installing ? "Installing…" : "Install on this device"}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-xl border border-slate-700/80 bg-slate-800/60 py-2.5 px-3.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
