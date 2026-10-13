import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import BusStop from "./models/BusStop.js";
import Route from "./models/Route.js";

await connectDB();

console.log("Configuring Evening Return Schedules for Bus 07 and Bus 17...");

// ===================== BUS 07 =====================
const route07 = await Route.findOne({
  $or: [{ routeNumber: "07" }, { direction: /Dewas Route$/i }],
}).populate("stops");

if (!route07) {
  console.error("Route 07 not found!");
} else {
  // Morning order stops in reverse:
  // College -> Tapobhoomi Tiraha -> Chandesari Fanta -> Narwar Fanta -> Palkhanda Fanta -> Bangar
  // -> Trilok Nagar Chouraha -> GDC Etawa -> Bima Chouraha -> Karmdeep Chouraha -> Sayaji Dwar
  // -> Van Mandal Chouraha -> Kaila Devi Chouraha -> Vikas Nagar -> Amona -> Sanjay Nagar Chouraha -> Kshipra.
  const stops07 = await BusStop.find({ routeId: route07._id });
  const findStop07 = (patterns) => {
    for (const p of patterns) {
      const match = stops07.find((s) =>
        s.name.trim().toLowerCase().includes(p.toLowerCase())
      );
      if (match) return match;
    }
    return null;
  };

  const eveningList07 = [
    { place: "COLLEGE", time: "15:30", patterns: ["Prashanti Institute", "College"] },
    { place: "TAPOBHUMI TIRAHA", time: "15:35", patterns: ["TAPOBHUMI TIRAHA", "Tapobhoomi"] },
    { place: "CHANDESARI FANTA", time: "15:45", patterns: ["CHANDESARI FANTA", "Chandesari"] },
    { place: "NARWAR FANTA", time: "15:50", patterns: ["Narwar, Ujjain", "Narwar"] },
    { place: "PALKHANDA FANTA", time: "15:55", patterns: ["PALKHANDA FANTA", "Palkhanda"] },
    { place: "BANGAR (AMLATAS HOSPITAL)", time: "16:00", patterns: ["Bangar (Amaltas Hospital)", "Bangar"] },
    { place: "TRILOK NAGAR CHOURAHA", time: "16:15", patterns: ["Trilok Nagar Chouraha", "Trilok Nagar"] },
    { place: "GDC ETAWA", time: "16:20", patterns: ["GDC College Itawa", "GDC Etawa"] },
    { place: "BIMA CHOURAHA", time: "16:25", patterns: ["Beema Chouraha", "Bima Chouraha"] },
    { place: "KARMDEEP CHOURAHA", time: "16:30", patterns: ["Karmdeep Chouraha"] },
    { place: "SAYAJI DWAR", time: "16:35", patterns: ["Sayaji Dwar"] },
    { place: "VAN MANDAL CHOURAHA", time: "16:40", patterns: ["Van Mandal Chouraha"] },
    { place: "KAILA DEVI CHOURAHA", time: "16:45", patterns: ["Kela Devi Chouraha", "Kaila Devi"] },
    { place: "VIKAS NAGAR", time: "16:50", patterns: ["Vikas Nagar"] },
    { place: "AMONA", time: "16:55", patterns: ["Amona"] },
    { place: "SANJAY NAGAR CHOURAHA", time: "17:05", patterns: ["Sanjay Nagar Chouraha", "Sanjay Nagar"] },
    { place: "KSHIPRA", time: "17:25", patterns: ["Kshipra"] },
  ];

  const eveningScheduledStops07 = [];
  const eveningStops07Ids = [];

  for (const item of eveningList07) {
    const matched = findStop07(item.patterns);
    const stopId = matched ? matched._id : null;
    eveningScheduledStops07.push({
      place: item.place,
      time: item.time,
      stopId,
    });
    if (stopId && !eveningStops07Ids.includes(stopId)) {
      eveningStops07Ids.push(stopId);
    }
  }

  route07.eveningScheduledStops = eveningScheduledStops07;
  route07.eveningStops = eveningStops07Ids;
  await route07.save();
  console.log(
    `Route 07 configured with ${eveningScheduledStops07.length} evening scheduled stops and ${eveningStops07Ids.length} evening route stops.`
  );
}

// ===================== BUS 17 =====================
const route17 = await Route.findOne({
  $or: [
    { routeNumber: "17" },
    { direction: "Dewas Route 02" },
    { name: "Dewas Route 02" },
  ],
}).populate("stops");

if (!route17) {
  console.error("Route 17 not found!");
} else {
  // Bus 17 evening stop order:
  // College -> Tapobhoomi Tiraha -> Bangar -> Singawada -> Etawa/Trilok Nagar Main Road
  // -> Ujjain Road Petrol Pump -> Aawas Nagar -> Siddhivinayak Hotel -> Jaitpura -> Siroliya -> Palnagar -> Vikas Nagar.
  const stops17 = await BusStop.find({ routeId: route17._id });
  const findStop17 = (patterns) => {
    for (const p of patterns) {
      const match = stops17.find((s) =>
        s.name.trim().toLowerCase().includes(p.toLowerCase())
      );
      if (match) return match;
    }
    return null;
  };

  const eveningList17 = [
    { place: "College", time: "15:30", patterns: ["College"] },
    { place: "Tapobhoomi Tiraha", time: "15:35", patterns: ["Tapobhoomi Tiraha", "Tapobhoomi"] },
    { place: "Bangar (Amaltas Hospital)", time: "16:00", patterns: ["Bangar (Amaltas Hospital)", "Bangar"] },
    { place: "Singawada", time: "16:05", patterns: ["Singawada"] },
    { place: "Etawa / Trilok Nagar Main Road", time: "16:15", patterns: ["Etawa / Trilok Nagar Main Road", "Etawa"] },
    { place: "Ujjain Road Petrol Pump", time: "16:25", patterns: ["Ujjain Road Petrol Pump", "Petrol Pump"] },
    // After Petrol Pump: separate estimated travel intervals (configurable by admin)
    { place: "Aawas Nagar", time: "16:40", patterns: ["Aawas Nagar"] },
    { place: "Siddhivinayak Hotel", time: "16:45", patterns: ["Siddhivinayak Hotel", "Siddhivinayak"] },
    { place: "Jaitpura", time: "16:50", patterns: ["Jaitpura"] },
    { place: "Sirollya", time: "17:10", patterns: ["Sirollya", "Siroliya"] },
    { place: "Pal Nagar", time: "17:25", patterns: ["Pal Nagar", "Palnagar"] },
    { place: "Vikas Nagar", time: "17:45", patterns: ["Vikas Nagar"] },
  ];

  const eveningScheduledStops17 = [];
  const eveningStops17Ids = [];

  for (const item of eveningList17) {
    const matched = findStop17(item.patterns);
    const stopId = matched ? matched._id : null;
    eveningScheduledStops17.push({
      place: item.place,
      time: item.time,
      stopId,
    });
    if (stopId && !eveningStops17Ids.includes(stopId)) {
      eveningStops17Ids.push(stopId);
    }
  }

  route17.eveningScheduledStops = eveningScheduledStops17;
  route17.eveningStops = eveningStops17Ids;
  await route17.save();
  console.log(
    `Route 17 configured with ${eveningScheduledStops17.length} evening scheduled stops and ${eveningStops17Ids.length} evening route stops.`
  );
}

console.log("Evening return schedules configured successfully!");
await mongoose.disconnect();
