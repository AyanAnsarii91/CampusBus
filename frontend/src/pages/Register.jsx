import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BusFront, Lock, Mail, Phone, User, KeyRound, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { auth, googleProvider } from "../services/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";

export default function Register() {
  const { register, loginWithFirebase } = useAuth();
  const nav = useNavigate();

  const [authMethod, setAuthMethod] = useState("email"); // "email" | "phone"
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [phoneName, setPhoneName] = useState("");
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

  // Google Sign-Up
  const handleGoogleSignUp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const idToken = await res.user.getIdToken();
      await loginWithFirebase(idToken, {
        name: res.user.displayName,
      });
      nav("/student/dashboard", { replace: true });
    } catch (err) {
      console.error("Google registration error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-up popup was closed before completing.");
      } else {
        setError(
          err.response?.data?.message ||
          err.message ||
          "Google sign-up failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Email / Password Sign-Up
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create user in Firebase Auth
      let fbUser = null;
      try {
        const res = await createUserWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password,
        );
        fbUser = res.user;
        await updateProfile(fbUser, { displayName: form.name.trim() });
      } catch (fbErr) {
        console.warn("Firebase create user warning:", fbErr.code, fbErr.message);
        if (fbErr.code === "auth/email-already-in-use") {
          setError("Email is already registered. Please sign in instead.");
          setLoading(false);
          return;
        }
      }

      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        await loginWithFirebase(idToken, { name: form.name.trim() });
        nav("/student/dashboard", { replace: true });
        return;
      }

      // 2. Fallback to direct backend registration
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "student",
      });
      nav("/student/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  // Phone: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");

    if (!phoneName.trim()) {
      setError("Please enter your full name.");
      return;
    }

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
          "register-recaptcha-container",
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
      console.error("Phone sign-up error:", err);
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
      if (phoneName.trim()) {
        try {
          await updateProfile(res.user, { displayName: phoneName.trim() });
        } catch {
          // ignore
        }
      }
      const idToken = await res.user.getIdToken();
      await loginWithFirebase(idToken, { name: phoneName.trim() });
      nav("/student/dashboard", { replace: true });
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
    <div className="min-h-screen bg-slate-950 p-4">
      {/* Invisible Recaptcha container for Phone Auth */}
      <div id="register-recaptcha-container"></div>

      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-lg items-center rounded-3xl bg-white p-7 sm:p-10 shadow-2xl">
        <div className="w-full">
          <div className="flex items-center gap-2 font-black text-slate-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">
              <BusFront />
            </span>
            CampusBus
          </div>

          <h1 className="mt-7 text-3xl font-black text-slate-900">
            Create student account
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Get instant real-time live tracking and timetable notifications.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 border border-red-200"
            >
              {error}
            </div>
          )}

          {/* Google Sign-Up Provider */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignUp}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            Sign up with Google
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-semibold text-slate-400">
                Or register with
              </span>
            </div>
          </div>

          {/* Segmented Auth Method Switcher */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMethod("email");
                setError("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${authMethod === "email"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <Mail size={14} /> Email
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod("phone");
                setError("");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${authMethod === "phone"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <Phone size={14} /> Phone OTP
            </button>
          </div>

          {/* Email / Password Sign-Up Form (NO Student ID field) */}
          {authMethod === "email" && (
            <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Full Name
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 transition focus-within:border-blue-500">
                  <User size={16} className="text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                  />
                </div>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Email
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 transition focus-within:border-blue-500">
                  <Mail size={16} className="text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="student@college.edu"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                  />
                </div>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Password (min 8 characters)
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 transition focus-within:border-blue-500">
                  <Lock size={16} className="text-slate-400" />
                  <input
                    required
                    type="password"
                    minLength={8}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-5 w-full rounded-xl bg-slate-900 py-3 font-bold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create Student Account"}
              </button>
            </form>
          )}

          {/* Phone OTP Sign-Up Form (NO Student ID field) */}
          {authMethod === "phone" && (
            <div className="mt-4">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Full Name
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 transition focus-within:border-blue-500">
                      <User size={16} className="text-slate-400" />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={phoneName}
                        onChange={(e) => setPhoneName(e.target.value)}
                        className="w-full bg-transparent py-2.5 text-sm outline-none"
                      />
                    </div>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Mobile Number
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 transition focus-within:border-blue-500">
                      <Phone size={16} className="text-slate-400" />
                      <input
                        required
                        type="tel"
                        placeholder="+91 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-transparent py-2.5 text-sm outline-none font-mono"
                      />
                    </div>
                  </label>

                  <p className="text-[11px] text-slate-500">
                    We’ll send an SMS verification code to verify your phone number.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-bold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? "Sending OTP…" : "Send Verification Code"}
                    <ArrowRight size={15} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">
                      OTP sent to <strong className="text-slate-900">{phone}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setError("");
                      }}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <label className="block text-xs font-bold text-slate-700">
                    6-Digit Verification Code
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 px-3 transition focus-within:border-blue-500">
                      <KeyRound size={16} className="text-slate-400" />
                      <input
                        required
                        type="text"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-transparent py-2.5 text-sm outline-none font-mono tracking-widest text-center font-bold"
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? "Verifying…" : "Verify & Complete Signup"}
                  </button>
                </form>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link className="font-bold text-blue-600 hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
