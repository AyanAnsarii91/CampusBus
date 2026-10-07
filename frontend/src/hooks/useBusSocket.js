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
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: sessionStorage.getItem("campusbus_token") },
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
      setLocation((prev) => ({ ...(prev || {}), ...data }));
      notify(
        "CampusBus",
        data.status === "offline"
          ? "Your bus is now offline."
          : `Bus status: ${data.status}`,
      );
    });
    socket.on("trip:started", () =>
      notify("CampusBus", "Your bus trip has started."),
    );
    socket.on("trip:ended", () =>
      notify("CampusBus", "Your bus trip has ended."),
    );
    return () => {
      socket.emit("student:untrack-bus", { busId });
      socket.disconnect();
    };
  }, [busId, enabled]);
  return { location, connection };
}
