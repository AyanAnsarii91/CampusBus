import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import Bus from "./models/Bus.js";
import Route from "./models/Route.js";

await connectDB();

const route = await Route.findOneAndUpdate(
  { routeNumber: "07" },
  {
    name: "PRASHANTI GROUP OF INSTITUTIONS, UJJAIN",
    routeNumber: "07",
    direction: "Dewas Route",
    effectiveFrom: "16/09/2026",
    busRegistration: "MP13 P 1352",
    driverName: "Inder Prajapat",
    driverMobile: "9669594030",
    busInCharge: "PGI",
    instructions: [
      "Staff and students should reach their stop five minutes before the scheduled time.",
      "Use of mobile phones is strictly prohibited on the bus.",
      "The bus will stop only at the listed fixed-route stops.",
    ],
    scheduledStops: [
      { place: "KSHIPRA", time: "07:00" },
      { place: "SANJAY NAGAR CHOURAHA", time: "07:20" },
      { place: "AMONA", time: "07:30" },
      { place: "VIKAS NAGAR", time: "07:35" },
      { place: "KAILA DEVI CHOURAHA", time: "07:40" },
      { place: "VAN MANDAL CHOURAHA", time: "07:45" },
      { place: "SAYAJI DWAR", time: "07:50" },
      { place: "KARMDEEP CHOURAHA", time: "07:55" },
      { place: "BIMA CHOURAHA", time: "08:00" },
      { place: "GDC ETAWA", time: "08:05" },
      { place: "TRILOK NAGAR CHOURAHA", time: "08:10" },
      { place: "BANGAR (AMLATAS HOSPITAL)", time: "08:25" },
      { place: "PALKHANDA FANTA", time: "08:30" },
      { place: "NARWAR FANTA", time: "08:35" },
      { place: "CHANDESARI FANTA", time: "08:40" },
      { place: "TAPOBHUMI TIRAHA", time: "08:50" },
      { place: "COLLEGE", time: "08:55" },
    ],
  },
  { new: true, upsert: true, runValidators: true },
);

await Bus.findOneAndUpdate(
  { registrationNumber: "MP13 P 1352" },
  {
    busNumber: "Bus 07",
    registrationNumber: "MP13 P 1352",
    routeId: route._id,
  },
  { new: true, upsert: true, runValidators: true },
);

console.log("Route Bus No. 07 added or updated.");
await mongoose.disconnect();
