import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyFirebaseToken } from "../services/firebaseAuth.js";

export async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer "))
      return res.status(401).json({ message: "Authentication required" });
    const token = h.slice(7).trim();
    let user = null;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(payload.id).select("-password");
    } catch {
      try {
        const decoded = await verifyFirebaseToken(token);
        if (decoded?.uid) {
          user = await User.findOne({ firebaseUid: decoded.uid }).select("-password");
          if (!user && decoded.email) {
            user = await User.findOne({ email: decoded.email.trim().toLowerCase() }).select("-password");
          }
        }
      } catch {}
    }
    if (!user) return res.status(401).json({ message: "Invalid or expired token" });
    if (user.isActive === false) {
      return res.status(403).json({ message: "This account has been deactivated." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ message: "Insufficient permissions" });
