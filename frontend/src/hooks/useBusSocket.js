import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../services/api";

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
    const token =
      sessionStorage.getItem("campusbus_token") ||
      localStorage.getItem("campusbus_token");
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnection("connected");
      socket.emit("student:track-bus", { busId });
    });
    socket.on("disconnect", () => setConnection("reconnecting"));
    socket.on("connect_error", () => setConnection("error"));
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
