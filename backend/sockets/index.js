import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { processLocation } from "../services/location.js";
import Bus from "../models/Bus.js";
import { verifyFirebaseToken } from "../services/firebaseAuth.js";

export function setupSockets(io) {
  io.use(async (socket, next) => {
    try {
      const raw =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.auth?.Authorization;
      if (!raw) return next(new Error("Authentication required"));
      const token =
        typeof raw === "string" && raw.startsWith("Bearer ")
          ? raw.slice(7).trim()
          : typeof raw === "string"
            ? raw.trim()
            : raw;
      if (!token) return next(new Error("Authentication required"));

      let user = null;
      // 1. Try backend JWT verification
      try {
        const p = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(p.id);
      } catch (jwtErr) {
        // 2. Fallback: try Firebase ID token verification
        try {
          const decoded = await verifyFirebaseToken(token);
          if (decoded?.uid) {
            user = await User.findOne({ firebaseUid: decoded.uid });
            if (!user && decoded.email) {
              user = await User.findOne({ email: decoded.email.trim().toLowerCase() });
            }
          }
        } catch (fbErr) {
          console.warn("[Socket Auth] Handshake token verification failed:", {
            jwtError: jwtErr.message,
            fbError: fbErr.message,
          });
        }
      }

      if (!user) {
        return next(new Error("Invalid token"));
      }
      if (user.isActive === false) {
        return next(new Error("User not found or account deactivated"));
      }
      socket.user = user;
      next();
    } catch (err) {
      console.error("[Socket Auth Handshake Error]", err);
      next(new Error("Invalid token"));
    }
  });
  io.on("connection", (socket) => {
    socket.on("student:track-bus", async ({ busId }) => {
      if (socket.user.role !== "student") return;
      socket.join(`bus:${busId}`);
    });
    socket.on("student:untrack-bus", ({ busId }) =>
      socket.leave(`bus:${busId}`),
    );
    socket.on("driver:location", async (payload) => {
      try {
        if (socket.user.role !== "driver") return;
        const driver = await User.findById(socket.user._id).select("role isActive");
        if (!driver || driver.isActive === false) {
          socket.emit("location:error", { message: "Driver account is deactivated." });
          socket.disconnect(true);
          return;
        }
        const bus = await Bus.findById(payload.busId);
        if (!bus || String(bus.driverId) !== String(driver._id))
          return socket.emit("location:error", {
            message: "Not assigned to this bus",
          });
        const data = await processLocation(payload);
        io.to(`bus:${payload.busId}`).emit("bus:location", data);
        socket.emit("location:accepted", { timestamp: data.timestamp });
      } catch (e) {
        socket.emit("location:error", { message: e.message });
      }
    });
    socket.on("simulator:location", async (payload) => {
      try {
        if (socket.user.role !== "admin") return;
        const data = await processLocation(payload);
        io.to(`bus:${payload.busId}`).emit("bus:location", data);
      } catch (e) {
        socket.emit("location:error", { message: e.message });
      }
    });
    socket.on("disconnect", () => {});
  });
}
