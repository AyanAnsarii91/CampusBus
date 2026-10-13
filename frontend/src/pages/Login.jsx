import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  BusFront,
  Lock,
  Mail,
  Phone,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  MapPin,
  ShieldCheck,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { auth, googleProvider } from "../services/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import logoImg from "../assets/PrashantiCampusBusTrackingLogo.png";

export default function Login() {
  const { login, loginWithFirebase } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [authMethod, setAuthMethod] = useState("email"); // "email" | "phone"
  const [form, setForm] = useState({
    email: "student@campusbus.demo",
    password: "password123",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const recaptchaVerifierRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // Ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const redirectAfterLogin = (role) => {
    const from = location.state?.from;
    if (from && typeof from === "string") {
      nav(from, { replace: true });
    } else {
      nav(`/${role}/dashboard`, { replace: true });
    }
  };

  // Google Authentication
  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const idToken = await res.user.getIdToken();
      const backendRes = await loginWithFirebase(idToken, {
        name: res.user.displayName,
      });
      redirectAfterLogin(backendRes.user.role);
    } catch (err) {
      console.error("Google sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completing.");
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Google sign-in failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Email / Password Authentication
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Attempt Firebase Email/Password login first
      let fbUser = null;
      try {
        const fbRes = await signInWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password,
        );
        fbUser = fbRes.user;
      } catch (fbErr) {
        if (
          fbErr.code !== "auth/user-not-found" &&
          fbErr.code !== "auth/invalid-credential"
        ) {
          console.warn("Firebase email auth note:", fbErr.code, fbErr.message);
        }
      }

      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        const backendRes = await loginWithFirebase(idToken);
        redirectAfterLogin(backendRes.user.role);
        return;
      }

      // 2. Seamless fallback to existing MongoDB / JWT credentials
      const r = await login(form);
      redirectAfterLogin(r.user.role);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // Phone: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");

    const cleanedPhone = phone.trim().replace(/[\s-]/g, "");
    if (!cleanedPhone) {
      setError("Please enter a valid phone number.");
      return;
    }

    const formattedPhone = cleanedPhone.startsWith("+")
      ? cleanedPhone
      : `+91${cleanedPhone}`;

    setLoading(true);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          {
            size: "invisible",
            callback: () => {
              // reCAPTCHA solved
            },
            "expired-callback": () => {
              setError("reCAPTCHA expired. Please try sending OTP again.");
            },
          },
        );
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        recaptchaVerifierRef.current,
      );
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (err) {
      console.error("Phone sign-in error:", err);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaVerifierRef.current = null;
      }
      if (err.code === "auth/invalid-phone-number") {
        setError("Invalid phone number format. Include country code (e.g. +91 9876543210).");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many OTP requests. Please wait a moment and try again.");
      } else {
        setError(err.message || "Failed to send OTP. Please check your number.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setError("");
    setLoading(true);
    try {
      const res = await confirmationResult.confirm(otp.trim());
      const idToken = await res.user.getIdToken();
      const backendRes = await loginWithFirebase(idToken);
      redirectAfterLogin(backendRes.user.role);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError(
        err.response?.data?.message ||
          "Invalid OTP code. Please enter the 6-digit code received on your phone.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 font-sans text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">
      {/* Background Ambient Glows & Grid Pattern */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[160px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />

      {/* Invisible Recaptcha container for Phone Auth */}
      <div id="recaptcha-container"></div>

      {/* Main Glass Container */}
      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_0_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl lg:grid lg:grid-cols-12">
        {/* Left Side: Rich Visual Transit Showcase */}
        <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 p-8 lg:col-span-5 lg:flex lg:p-10">
          {/* Subtle Corner Accent Glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />

          {/* Brand Header */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/25">
                <div className="grid h-full w-full place-items-center rounded-2xl bg-slate-950">
                  <img
                    src={logoImg}
                    alt="CampusBus"
                    className="h-8 w-8 object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "block";
                    }}
                  />
                  <BusFront className="hidden text-blue-400" size={24} />
                </div>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  CampusBus
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-blue-400 border border-blue-500/20 uppercase">
                    Transit
                  </span>
                </span>
                <p className="text-[11px] font-medium text-slate-400">
                  Real-time Institutional Mobility
                </p>
              </div>
            </div>

            {/* Live Transit Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-xs backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Live GPS Transit Active</span>
            </div>

            {/* Main Headline */}
            <div>
              <h1 className="text-3xl font-black leading-tight text-white xl:text-4xl">
                Know where your bus is.{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                  Know when it arrives.
                </span>
              </h1>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                End the daily group-chat archaeology. Get precise telemetry, dynamic ETAs, and verified route schedules directly on your screen.
              </p>
            </div>
          </div>

          {/* Interactive Route Simulation Card */}
          <div className="my-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-inner backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Compass size={14} className="text-blue-400" />
                Dewas Route 02
              </span>
              <span className="font-mono text-[11px] font-semibold text-cyan-400">
                Bus 17 • MP13
              </span>
            </div>

            {/* Route Timeline visualization */}
            <div className="relative pt-2 pb-1">
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 animate-pulse" />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin size={11} className="text-emerald-400" />
                  Aawas Nagar
                </span>
                <span className="font-bold text-white flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                  College Campus
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2 text-[11px] border border-slate-800">
              <span className="text-slate-400">Next Stop:</span>
              <span className="font-bold text-emerald-400">Vikas Nagar (~4 mins)</span>
            </div>
          </div>

          {/* Security & Feature Highlights */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-400 border-t border-white/5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>Route-specific stops</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-blue-400 shrink-0" />
              <span>Verified driver telemetry</span>
            </div>
          </div>
        </div>

        {/* Right Side: Glassmorphism Auth Form */}
        <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-7 xl:p-12">
          {/* Mobile Brand Bar */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5 font-black text-white">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600">
                <BusFront size={20} className="text-white" />
              </div>
              <span className="text-lg">CampusBus</span>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              ● Live Transit
            </span>
          </div>

          {/* Form Header */}
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-blue-400">
              Institutional Portal
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Welcome back
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Sign in to access live bus tracking, ETAs, and verified schedules.
            </p>
          </div>

          {/* Error Message Box */}
          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-300 backdrop-blur-md"
            >
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Google Sign-In Provider Button */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/40 py-3 px-4 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:border-slate-500 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-slate-900/90 px-3 font-semibold text-slate-500">
                Or sign in with credentials
              </span>
            </div>
          </div>

          {/* Segmented Auth Method Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-950/80 p-1 text-xs font-bold border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setAuthMethod("email");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
                authMethod === "email"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Mail size={14} />
              <span>Email & Password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod("phone");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
                authMethod === "phone"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Phone size={14} />
              <span>Phone OTP</span>
            </button>
          </div>

          {/* Tab 1: Email & Password Form */}
          {authMethod === "email" && (
            <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Institutional Email
                </label>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <input
                    required
                    type="email"
                    placeholder="student@campusbus.demo"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <Lock size={16} className="text-slate-400 shrink-0" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-200 focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:bg-[position:right_center] hover:shadow-blue-500/40 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: Phone OTP Form */}
          {authMethod === "phone" && (
            <div className="mt-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      Mobile Number
                    </label>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      <Phone size={16} className="text-slate-400 shrink-0" />
                      <input
                        required
                        type="tel"
                        placeholder="+91 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-transparent font-mono text-sm text-white placeholder-slate-500 outline-none"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Include country code (e.g. +91). A 6-digit SMS verification code will be sent.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:bg-[position:right_center] hover:shadow-blue-500/40 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Sending OTP…</span>
                      </>
                    ) : (
                      <>
                        <span>Send Verification Code</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Code sent to: <strong className="text-white font-mono">{phone}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setError("");
                      }}
                      className="font-bold text-cyan-400 hover:underline"
                    >
                      Change Number
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300">
                      6-Digit SMS Verification Code
                    </label>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      <KeyRound size={16} className="text-slate-400 shrink-0" />
                      <input
                        required
                        type="text"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-transparent text-center font-mono text-base font-black tracking-widest text-white placeholder-slate-600 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:bg-[position:right_center] hover:shadow-blue-500/40 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Sign In</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Footer Navigation Link */}
          <p className="mt-6 text-center text-xs text-slate-400">
            New student?{" "}
            <Link
              to="/register"
              className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors underline-offset-4 hover:underline"
            >
              Create student account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
