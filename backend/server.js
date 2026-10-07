import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import busRoutes from "./routes/buses.js";
import routeRoutes from "./routes/routes.js";
import stopRoutes from "./routes/stops.js";
import tripRoutes from "./routes/trips.js";
import userRoutes from "./routes/users.js";
import simulatorRoutes from "./routes/simulator.js";
import { setupSockets } from "./sockets/index.js";
import { notFound, errorHandler } from "./middleware/error.js";
const app = express();
const server = http.createServer(app);
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://prashanticampusbus.onrender.com",
];
const parseOrigins = (...values) =>
  values
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = [
  ...new Set([
    ...defaultOrigins,
    ...parseOrigins(process.env.CLIENT_URL, process.env.CORS_ORIGINS),
  ]),
];
const socketOrigins = [
  ...new Set([
    ...defaultOrigins,
    ...parseOrigins(
      process.env.CLIENT_URL,
      process.env.CORS_ORIGINS,
      process.env.SOCKET_IO_ORIGINS,
    ),
  ]),
];
const io = new Server(server, {
  cors: { origin: socketOrigins, credentials: true },
});
app.set("io", io);
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "100kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    service: "CampusBus API",
    time: new Date().toISOString(),
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/stops", stopRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/simulator", simulatorRoutes);
app.use(notFound);
app.use(errorHandler);
setupSockets(io);
const port = Number(process.env.PORT || 5000);
connectDB()
  .then(() =>
    server.listen(port, () =>
      console.log(`CampusBus API listening on ${port}`),
    ),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
