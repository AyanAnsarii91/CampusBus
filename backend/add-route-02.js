import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import Bus from "./models/Bus.js";
import Route from "./models/Route.js";

await connectDB();

const scheduledStops = [
  { place: "Aawas Nagar", time: "06:40" },
  { place: "Siddhivinayak Hotel", time: "06:45" },
  { place: "Jaitpura", time: "06:50" },
  { place: "Sirollya", time: "07:10" },
  { place: "Pal Nagar", time: "07:25" },
  { place: "Vikas Nagar", time: "07:45" },
  { place: "Ujjain Road Petrol Pump", time: "08:00" },
  { place: "Etawa / Trilok Nagar Main Road", time: "08:10" },
  { place: "Singawada", time: "08:20" },
  { place: "Bangar (Amaltas Hospital)", time: "08:25" },
  { place: "Tapobhoomi Tiraha", time: "08:50" },
  { place: "College", time: "08:55" },
];

const eveningScheduledStops = [
  { place: "College", time: "15:30" },
  { place: "Tapobhoomi Tiraha", time: "15:35" },
  { place: "Bangar (Amaltas Hospital)", time: "16:00" },
  { place: "Singawada", time: "16:05" },
  { place: "Etawa / Trilok Nagar Main Road", time: "16:15" },
  { place: "Ujjain Road Petrol Pump", time: "16:25" },
  { place: "Aawas Nagar", time: "16:40" },
  { place: "Siddhivinayak Hotel", time: "16:45" },
  { place: "Jaitpura", time: "16:50" },
  { place: "Sirollya", time: "17:10" },
  { place: "Pal Nagar", time: "17:25" },
  { place: "Vikas Nagar", time: "17:45" },
];

// Find existing Dewas Route 02 or create it
let route = await Route.findOne({
  $or: [
    { direction: "Dewas Route 02" },
    { name: "Dewas Route 02" },
    { routeNumber: "17" },
  ],
});

if (route) {
  route.name = route.name || "Dewas Route 02";
  route.routeNumber = "17";
  route.direction = "Dewas Route 02";
  route.busRegistration = route.busRegistration || "MP13";
  route.scheduledStops = scheduledStops;
  if (!route.eveningScheduledStops?.length) {
    route.eveningScheduledStops = eveningScheduledStops;
  }
  if (!route.instructions?.length) {
    route.instructions = [
      "Staff and students should reach their stop five minutes before the scheduled time.",
      "Use of mobile phones is strictly prohibited on the bus.",
      "The bus will stop only at the listed fixed-route stops.",
    ];
  }
  await route.save();
} else {
  route = await Route.create({
    name: "Dewas Route 02",
    routeNumber: "17",
    direction: "Dewas Route 02",
    busRegistration: "MP13",
    scheduledStops,
    instructions: [
      "Staff and students should reach their stop five minutes before the scheduled time.",
      "Use of mobile phones is strictly prohibited on the bus.",
      "The bus will stop only at the listed fixed-route stops.",
    ],
    stops: [],
  });
}

// Ensure Bus 17 MP13 exists and can be assigned
let bus = await Bus.findOne({
  $or: [{ busNumber: "Bus 17" }, { registrationNumber: "MP13" }],
});

if (!bus) {
  bus = await Bus.create({
    busNumber: "Bus 17",
    registrationNumber: "MP13",
    routeId: route._id,
    status: "offline",
  });
} else if (!bus.routeId) {
  bus.routeId = route._id;
  await bus.save();
}

console.log("Dewas Route 02 configured successfully.");
console.log(`Route ID: ${route._id} (${route.name} - ${route.direction})`);
console.log(`Bus: ${bus.busNumber} (${bus.registrationNumber}) -> Route: ${route.direction}`);
console.log(`Scheduled timetable: ${route.scheduledStops.length} stops`);

await mongoose.disconnect();
