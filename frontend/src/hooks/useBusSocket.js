import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL, authApi } from "../services/api";
import { auth } from "../services/firebase";

function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted")
    new Notification(title, { body });
}

export function useBusSocket(busId, enabled = true) {
  const socketRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [connection, setConnection] = useState("connecting");
  useEffect(() => {
    if (!enabled || !busId) return;

    const getLatestCleanToken = () => {
      let t =
        localStorage.getItem("campusbus_token") ||
        sessionStorage.getItem("campusbus_token") ||
        "";
      if (typeof t === "string" && t.startsWith("Bearer ")) {
        t = t.slice(7).trim();
      }
      return t;
    };

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: (cb) => {
        cb({ token: getLatestCleanToken() });
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnection("connected");
      socket.emit("student:track-bus", { busId });
    });
    socket.on("disconnect", () => setConnection("reconnecting"));
    socket.on("connect_error", async (error) => {
      setConnection("error");
      if (error?.message === "Invalid token" || error?.message === "Authentication required") {
        try {
          const fbUser = auth?.currentUser;
          if (fbUser) {
            const freshIdToken = await fbUser.getIdToken(true);
            const r = await authApi.firebaseLogin({ idToken: freshIdToken });
            if (r.data?.token) {
              localStorage.setItem("campusbus_token", r.data.token);
              socket.auth = { token: r.data.token };
              socket.connect();
            }
          }
        } catch (refreshErr) {
          console.warn("[useBusSocket] Auto token refresh on connect_error failed:", refreshErr);
        }
      }
    });
    socket.on("bus:location", (data) => setLocation(data));
    socket.on("bus:status", (data) => {
      setLocation((prev) => ({
        ...(prev || {}),
        ...data,
        ...(data.status === "offline"
          ? { latitude: null, longitude: null, speed: null, isLive: false }
          : {}),
      }));
      notify(
        "CampusBus",
        data.status === "offline"
          ? "Your bus is now offline."
          : `Bus status: ${data.status}`,
      );
    });
    socket.on("trip:started", (data) => {
      setLocation((prev) => ({
        ...(prev || {}),
        tripStarted: true,
        tripEnded: false,
        activeTrip: data,
        lastTrip: null,
        status: "active",
        shift: data.shift,
        latitude: null,
        longitude: null,
        speed: null,
        isLive: false,
      }));
      notify("CampusBus", "Your bus trip has started.");
    });
    socket.on("trip:ended", (data) => {
      setLocation((prev) => ({
        ...(prev || {}),
        tripEnded: true,
        tripEndedData: data,
        activeTrip: null,
        lastTrip: data,
        status: "offline",
        latitude: null,
        longitude: null,
        speed: null,
        etaByStop: {},
        delaysByStop: {},
        isLive: false,
      }));
      notify("CampusBus", "Your bus trip has ended.");
    });
    return () => {
      socket.emit("student:untrack-bus", { busId });
      socket.disconnect();
    };
  }, [busId, enabled]);
  return { location, connection };
}
