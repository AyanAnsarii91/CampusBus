import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BusFront, Lock, Mail } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: "student@campusbus.demo",
    password: "password123",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await login(form);
      nav(`/${r.user.role}/dashboard`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl lg:grid-cols-2">
        <div className="hidden bg-slate-900 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-black text-white">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600">
                <BusFront />
              </span>
              CampusBus
            </div>
            <h1 className="mt-20 text-5xl font-black leading-tight text-white">
              Know where your bus is.
              <br />
              <span className="text-blue-400">Know when it arrives.</span>
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Real-time campus mobility, without the daily “where is the bus?”
            group-chat archaeology.
          </p>
        </div>
        <div className="flex items-center p-7 sm:p-12">
          <form onSubmit={submit} className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-2 font-black">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
                  <BusFront />
                </span>
                CampusBus
              </div>
            </div>
            <p className="text-sm font-bold text-blue-600">WELCOME BACK</p>
            <h2 className="mt-2 text-3xl font-black">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">
              Track your campus bus in real time.
            </p>
            {error && (
              <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}
            <label className="mt-6 block text-sm font-semibold">
              Email
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Mail size={17} className="text-slate-400" />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-transparent py-3 outline-none"
                />
              </div>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Password
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                <Lock size={17} className="text-slate-400" />
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="w-full bg-transparent py-3 outline-none"
                />
              </div>
            </label>
            <button
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="mt-5 text-center text-sm text-slate-500">
              New student?{" "}
              <Link className="font-bold text-blue-600" to="/register">
                Create account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
