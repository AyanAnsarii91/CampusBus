import "dotenv/config";
import jwt from "jsonwebtoken";
import http from "http";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import { processLocation } from "../services/location.js";

const BACKEND_URL = "http://localhost:5000";

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND_URL);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log("=== STARTING 4-SCENARIO TRACKING VALIDATION ===");
  await connectDB();

  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    console.error("No admin user found in database!");
    process.exit(1);
  }
  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  console.log("✓ Generated valid admin token for:", admin.email);

  const bus7 = await Bus.findOne({ busNumber: "Bus 07" });
  const bus17 = await Bus.findOne({ busNumber: "Bus 17" });
  console.log(`✓ Verified buses: Bus 07 (${bus7?._id}), Bus 17 (${bus17?._id})`);

  // Ensure any previous trips on Bus 07 are cleaned up first
  await Trip.updateMany({ busId: bus7._id, status: "active" }, { $set: { status: "ended", endedAt: new Date() } });
  await Bus.updateOne({ _id: bus7._id }, { $set: { status: "offline" }, $unset: { currentLocation: 1, lastUpdated: 1 } });

  // SCENARIO 1: NIGHT / NO ACTIVE TRIP
  console.log("\n--- SCENARIO 1: Night / No Active Trip ---");
  const loc1 = await request("GET", `/api/buses/${bus7._id}/location`, null, token);
  console.log("Response:", JSON.stringify(loc1.body, null, 2));

  if (loc1.body.location === null && loc1.body.isLive === false && loc1.body.status === "offline") {
    console.log("✅ PASS Scenario 1: Location is null, isLive is false, status is offline. Zero fake/misleading live data.");
  } else {
    console.error("❌ FAIL Scenario 1: Expected location: null and isLive: false, got:", loc1.body);
    process.exit(1);
  }

  // SCENARIO 2: ACTIVE TRIP WITH FRESH GPS
  console.log("\n--- SCENARIO 2: Active Trip with Fresh GPS ---");
  const startRes = await request("POST", "/api/simulator/start", {
    busId: bus7._id,
    shift: "morning",
    intervalMs: 5000
  }, token);
  console.log("Simulator start response:", startRes.body);
  const tripId = startRes.body?.trip?._id;

  const processed = await processLocation({
    busId: bus7._id,
    tripId,
    latitude: 22.8450,
    longitude: 75.9550,
    speed: 38,
    heading: 90,
    timestamp: new Date()
  });
  console.log("Processed fresh GPS point:", processed.isLive, processed.latitude, processed.speed);

  const loc2 = await request("GET", `/api/buses/${bus7._id}/location`, null, token);
  console.log("Location during active trip:", JSON.stringify(loc2.body, null, 2));

  if (
    loc2.body.location &&
    loc2.body.isLive === true &&
    loc2.body.location.latitude === 22.8450 &&
    loc2.body.location.speed === 38 &&
    loc2.body.activeTrip?.status === "active"
  ) {
    console.log("✅ PASS Scenario 2: Active trip provides fresh coordinates, isLive=true, and correct speed & trip state.");
  } else {
    console.error("❌ FAIL Scenario 2: Expected valid live location, got:", loc2.body);
    process.exit(1);
  }

  // SCENARIO 3: STALE GPS (> 120s old)
  console.log("\n--- SCENARIO 3: Stale GPS (> 120s old) ---");
  const staleTimestamp = new Date(Date.now() - 180000); // 3 minutes ago
  await Bus.updateOne(
    { _id: bus7._id },
    {
      $set: {
        "currentLocation.timestamp": staleTimestamp,
        lastUpdated: staleTimestamp
      }
    }
  );
  console.log("Manually set Bus 07 location timestamp to 3 minutes ago:", staleTimestamp.toISOString());

  const loc3 = await request("GET", `/api/buses/${bus7._id}/location`, null, token);
  console.log("Location with stale GPS:", JSON.stringify(loc3.body, null, 2));

  if (loc3.body.location === null && loc3.body.isLive === false && loc3.body.status === "stale" && loc3.body.stale === true) {
    console.log("✅ PASS Scenario 3: Stale GPS correctly returned location: null, isLive: false, status: 'stale', stale: true. Stale coordinates are NEVER reused as live.");
  } else {
    console.error("❌ FAIL Scenario 3: Expected status: 'stale' and location: null, got:", loc3.body);
    process.exit(1);
  }

  // SCENARIO 4: TRIP COMPLETION
  console.log("\n--- SCENARIO 4: After Trip Completion ---");
  const stopRes = await request("POST", "/api/simulator/stop", {
    tripId
  }, token);
  console.log("Simulator stop response:", stopRes.body);

  const loc4 = await request("GET", `/api/buses/${bus7._id}/location`, null, token);
  console.log("Location after trip ended:", JSON.stringify(loc4.body, null, 2));

  if (
    loc4.body.location === null &&
    loc4.body.isLive === false &&
    loc4.body.status === "offline" &&
    loc4.body.lastTrip?.status === "ended"
  ) {
    console.log("✅ PASS Scenario 4: Trip stopped cleanly. Coordinates wiped, status offline, and backend confirms trip ended.");
  } else {
    console.error("❌ FAIL Scenario 4: Expected clean offline state with lastTrip ended, got:", loc4.body);
    process.exit(1);
  }

  console.log("\n🎉 ALL 4 SCENARIOS PASSED WITH ZERO ERRORS!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
