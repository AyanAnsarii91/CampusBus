import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "", variant = "icon" }) {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur transition hover:border-slate-300 dark:hover:border-slate-700 active:scale-95 ${className}`}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <span className="grid h-5 w-5 place-items-center rounded-lg bg-amber-500/10 text-amber-500 dark:bg-blue-500/10 dark:text-blue-400">
          {isDark ? <Sun size={13} /> : <Moon size={13} />}
        </span>
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${className}`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className="sr-only">Toggle theme</span>
      {isDark ? (
        <Sun
          size={18}
          className="text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45"
        />
      ) : (
        <Moon
          size={18}
          className="text-slate-700 transition-transform duration-300 -rotate-12 hover:rotate-0"
        />
      )}
    </button>
  );
}
