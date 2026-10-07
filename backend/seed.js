import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import BusStop from "./models/BusStop.js";
import Route from "./models/Route.js";
import Bus from "./models/Bus.js";
import Trip from "./models/Trip.js";
await connectDB();
await Promise.all([
  User.deleteMany({}),
  Bus.deleteMany({}),
  Route.deleteMany({}),
  BusStop.deleteMany({}),
  Trip.deleteMany({}),
]);
const coords = [
  [22.719568, 75.857726, "College Gate"],
  [22.7232, 75.8645, "Main Market"],
  [22.7258, 75.873, "City Center"],
  [22.7315, 75.8792, "Railway Station"],
  [22.7422, 75.889, "Vijay Nagar"],
  [22.751, 75.899, "Hostel"],
];
const stops = await BusStop.insertMany(
  coords.map((x, i) => ({
    latitude: x[0],
    longitude: x[1],
    name: x[2],
    sequence: i + 1,
  })),
);
const route = await Route.create({
  name: "Route A",
  stops: stops.map((s) => s._id),
});
const password = await bcrypt.hash("password123", 12);
const admin = await User.create({
  name: "Campus Admin",
  email: "admin@campusbus.demo",
  password,
  role: "admin",
});
const driver = await User.create({
  name: "Ravi Driver",
  email: "driver@campusbus.demo",
  password,
  role: "driver",
});
const student = await User.create({
  name: "Demo Student",
  email: "student@campusbus.demo",
  password,
  role: "student",
  studentId: "STU001",
  assignedStop: stops[2]._id,
});
const bus = await Bus.create({
  busNumber: "BUS 12",
  registrationNumber: "MP09 AB 1234",
  routeId: route._id,
  driverId: driver._id,
  status: "offline",
});
driver.assignedBusId = bus._id;
student.assignedBusId = bus._id;
await driver.save();
await student.save();
console.log("Seed complete");
console.log("Admin: admin@campusbus.demo / password123");
console.log("Driver: driver@campusbus.demo / password123");
console.log("Student: student@campusbus.demo / password123");
process.exit(0);
