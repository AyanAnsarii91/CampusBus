import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../services/api";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  ShieldCheck,
  IdCard,
  BusFront,
  ArrowRight,
  Info,
} from "lucide-react";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    dob: user?.dob || "",
  });

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Sync state if user context updates from remote
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        dob: user.dob || "",
      });
    }
  }, [user]);

  // Calculate dynamic profile completion percentage
  const completionCriteria = [
    { key: "name", label: "Full Name", weight: 20, completed: Boolean(formData.name?.trim()) },
    { key: "email", label: "Email Address", weight: 20, completed: Boolean(formData.email?.trim()) },
    { key: "phone", label: "Phone Number", weight: 20, completed: Boolean(formData.phone?.trim()) },
    { key: "dob", label: "Date of Birth", weight: 20, completed: Boolean(formData.dob?.trim()) },
    { key: "photo", label: "Profile Photo", weight: 20, completed: Boolean(user?.photoUrl || user?.profilePhoto) },
  ];

  const completionPercentage = completionCriteria.reduce(
    (sum, item) => sum + (item.completed ? item.weight : 0),
    0
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError("");
    setSuccessMessage("");
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob.trim(),
      };

      const res = await authApi.updateProfile(payload);
      if (res.data?.user) {
        updateUser(res.data.user);
        setSuccessMessage("Profile information updated successfully!");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Failed to update profile. Please check your network and try again.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset errors
    setPhotoError("");
    setSuccessMessage("");

    // Validate type
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validMimes.includes(file.type)) {
      setPhotoError("Please select a JPG, PNG, WEBP, or GIF image.");
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo size must be less than 5MB.");
      return;
    }

    const data = new FormData();
    data.append("photo", file);

    setUploadingPhoto(true);
    try {
      const res = await authApi.uploadPhoto(data);
      if (res.data?.user) {
        updateUser(res.data.user);
        setSuccessMessage("Profile photo uploaded and updated successfully!");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Could not upload photo. Please verify Supabase configuration.";
      setPhotoError(msg);
    } finally {
      setUploadingPhoto(false);
      // Reset input so same file can be reselected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    setUploadingPhoto(true);
    setPhotoError("");
    setSuccessMessage("");

    try {
      const res = await authApi.deletePhoto();
      if (res.data?.user) {
        updateUser(res.data.user);
        setSuccessMessage("Profile photo removed successfully.");
      }
    } catch (err) {
      setPhotoError(err.response?.data?.message || "Failed to remove photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "CB";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Page Title */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Account Profile
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your personal details, profile photo, and institutional credentials.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 capitalize">
              <ShieldCheck size={14} />
              {user?.role} Account
            </span>
          </div>
        </div>

        {/* Status / Alert Banners */}
        {successMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {formError && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-800 dark:text-red-300">
            <AlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400" />
            <span>{formError}</span>
          </div>
        )}

        {photoError && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Info size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{photoError}</span>
          </div>
        )}

        {/* Profile Completion Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Profile Completion
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                      completionPercentage === 100
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {completionPercentage}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {completionPercentage === 100
                    ? "Great job! All essential profile fields are completed."
                    : "Complete all fields to verify your institutional profile."}
                </p>
              </div>
            </div>
            {completionPercentage === 100 && (
              <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={13} />
                Verified Complete
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Completion Badges Checklist */}
          <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {completionCriteria.map((item) => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  item.completed
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                    : "bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
                }`}
              >
                {item.completed ? (
                  <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                )}
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Main Grid: Photo Box & Form */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Column 1: Profile Photo & Card */}
          <div className="space-y-6 md:col-span-1">
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-center">
              {/* Photo Container */}
              <div className="relative mx-auto h-32 w-32">
                <div className="relative h-full w-full overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md">
                  {user?.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt={user.name || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-3xl font-black text-white">
                      {getInitials(user?.name)}
                    </div>
                  )}

                  {uploadingPhoto && (
                    <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-xs text-white">
                      <Loader2 size={24} className="animate-spin text-blue-400" />
                    </div>
                  )}
                </div>

                {/* Camera upload action trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
                  title="Upload profile photo to Supabase"
                  aria-label="Upload profile photo"
                >
                  <Camera size={18} />
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <div className="mt-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {user?.name || "Student"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>

              {/* Photo Actions */}
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-98 disabled:opacity-50"
                >
                  <Camera size={14} />
                  <span>{user?.photoUrl ? "Change Photo" : "Upload Photo"}</span>
                </button>

                {user?.photoUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    disabled={uploadingPhoto}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 py-2 px-3 text-xs font-semibold transition active:scale-98 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>

              <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                JPG, PNG, or WEBP up to 5MB. Stored securely in Supabase Storage with signed access.
              </p>
            </div>

            {/* Quick Info Box */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Institutional Info
              </h4>

              {user?.role === "student" && (
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <IdCard size={15} className="text-slate-400" />
                  <span className="font-medium">Student ID:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {user?.studentId || "Not assigned"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <BusFront size={15} className="text-slate-400" />
                <span className="font-medium">Role:</span>
                <span className="font-bold capitalize text-slate-900 dark:text-white">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Editable Form */}
          <div className="md:col-span-2">
            <form
              onSubmit={handleProfileSubmit}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm space-y-5"
            >
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Personal Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your contact and identification details. Changes are synced across CampusBus.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User size={14} className="text-blue-500" />
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Ayan Ansari"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail size={14} className="text-blue-500" />
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  {user?.firebaseUid && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 size={10} /> Firebase Verified
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              {/* Phone Number & DOB */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Phone size={14} className="text-blue-500" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-500" />
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>


              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:shadow-blue-500/30 active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving changes…</span>
                    </>
                  ) : (
                    <>
                      <span>Save Changes</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
