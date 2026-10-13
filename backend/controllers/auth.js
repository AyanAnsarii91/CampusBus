import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyFirebaseToken } from "../services/firebaseAuth.js";
import {
  uploadProfilePhoto,
  createSignedPhotoUrl,
  deleteProfilePhoto,
  isSupabaseConfigured,
} from "../services/supabaseStorage.js";

const tokenFor = (u) =>
  jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

export const safe = (u, signedPhotoUrl = null) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  dob: u.dob || null,
  role: u.role,
  studentId: u.studentId,
  profilePhoto: u.profilePhoto || null,
  photoUrl: signedPhotoUrl || null,
  assignedStop: u.assignedStop,
  assignedBusId: u.assignedBusId,
});

export async function register(req, res, next) {
  try {
    const { name, email, password, studentId } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail }))
      return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      studentId: studentId ? String(studentId).trim() : undefined,
      role: "student",
    });
    res.status(201).json({ token: tokenFor(user), user: safe(user) });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : "";
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !(await bcrypt.compare(password || "", user.password || "")))
      return res.status(401).json({ message: "Invalid email or password" });
    if (user.isActive === false) {
      return res.status(403).json({ message: "This account has been deactivated. Contact an administrator." });
    }
    user.lastLoginAt = new Date();
    await user.save();
    let photoUrl = null;
    if (user.profilePhoto) {
      photoUrl = await createSignedPhotoUrl(user.profilePhoto, 3600);
    }
    res.json({ token: tokenFor(user), user: safe(user, photoUrl) });
  } catch (e) {
    next(e);
  }
}

export async function firebaseAuth(req, res, next) {
  try {
    const { idToken, name: clientName } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ message: "Firebase ID token is required." });
    }

    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({ message: "Invalid Firebase token payload." });
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email ? decoded.email.trim().toLowerCase() : null;
    const phone = decoded.phone_number ? decoded.phone_number.trim() : null;
    const name =
      (decoded.name && decoded.name.trim()) ||
      (clientName && clientName.trim()) ||
      (email ? email.split("@")[0] : phone) ||
      "Student";

    // 1. Look up by firebaseUid
    let user = await User.findOne({ firebaseUid });

    // 2. If not found by firebaseUid, look up by email to link existing account
    if (!user && email) {
      user = await User.findOne({ email });
      if (user) {
        user.firebaseUid = firebaseUid;
        if (phone && !user.phone) user.phone = phone;
        await user.save();
      }
    }

    // 3. If not found, look up by phone to link existing account
    if (!user && phone) {
      user = await User.findOne({ phone });
      if (user) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
    }

    // 4. If user still does not exist, create new student account
    // Enforce: Public signup can ONLY create student accounts
    if (!user) {
      const generatedEmail = email || `${firebaseUid}@phone.campusbus.local`;
      user = await User.create({
        name,
        email: generatedEmail,
        phone: phone || "",
        firebaseUid,
        role: "student",
        isActive: true,
      });
    }

    // 5. Check if user is active
    if (user.isActive === false) {
      return res.status(403).json({
        message: "This account has been deactivated. Contact an administrator.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    let photoUrl = null;
    if (user.profilePhoto) {
      photoUrl = await createSignedPhotoUrl(user.profilePhoto, 3600);
    }

    res.json({ token: tokenFor(user), user: safe(user, photoUrl) });
  } catch (error) {
    console.error("Firebase auth verification error:", error.message || error);
    if (error.code?.startsWith("auth/")) {
      return res.status(401).json({ message: `Firebase token verification failed: ${error.message}` });
    }
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    let photoUrl = null;
    if (req.user?.profilePhoto) {
      photoUrl = await createSignedPhotoUrl(req.user.profilePhoto, 3600);
    }
    res.json({ user: safe(req.user, photoUrl) });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, phone, dob, email, studentId } = req.body || {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      user.name = trimmed;
    }

    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (!normalized) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }
      // Prevent duplicate email across accounts
      const existing = await User.findOne({
        email: normalized,
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(409).json({ message: "Email is already in use by another account" });
      }
      user.email = normalized;
    }

    if (phone !== undefined) {
      user.phone = String(phone).trim();
    }

    if (dob !== undefined) {
      user.dob = String(dob).trim();
    }

    if (studentId !== undefined && user.role === "student") {
      user.studentId = String(studentId).trim();
    }

    await user.save();

    let photoUrl = null;
    if (user.profilePhoto) {
      photoUrl = await createSignedPhotoUrl(user.profilePhoto, 3600);
    }

    res.json({
      message: "Profile updated successfully",
      user: safe(user, photoUrl),
    });
  } catch (e) {
    next(e);
  }
}

export async function uploadPhoto(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No photo file provided." });
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: "Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.",
      });
    }

    // 5MB limit
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        message: "File exceeds 5MB size limit.",
      });
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        message:
          "Supabase Storage is not configured yet. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the backend.",
        requiresConfig: true,
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const previousPath = user.profilePhoto;

    // Upload to user's secure path in Supabase
    const storagePath = await uploadProfilePhoto(
      user._id,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    user.profilePhoto = storagePath;
    await user.save();

    // Clean up previous image if path differed
    if (previousPath && previousPath !== storagePath) {
      await deleteProfilePhoto(previousPath);
    }

    const photoUrl = await createSignedPhotoUrl(storagePath, 3600);

    res.json({
      message: "Profile photo uploaded successfully",
      photoUrl,
      profilePhoto: storagePath,
      user: safe(user, photoUrl),
    });
  } catch (e) {
    console.error("Profile photo upload error:", e.message || e);
    return res.status(400).json({
      message: e.message || "Failed to upload profile photo to storage.",
      error: e.message,
    });
  }
}

export async function deletePhoto(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.profilePhoto) {
      await deleteProfilePhoto(user.profilePhoto);
      user.profilePhoto = null;
      await user.save();
    }

    res.json({
      message: "Profile photo removed",
      user: safe(user, null),
    });
  } catch (e) {
    next(e);
  }
}
