import mongoose from "mongoose";
import BusStop from "../models/BusStop.js";
import Route from "../models/Route.js";

function parseCoordinate(value, label, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw Object.assign(
      new Error(`${label} must be a valid number between ${min} and ${max}.`),
      { status: 400 },
    );
  }
  return parsed;
}

function handleStopError(error, next, res) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message || "Invalid stop data." });
  }
  next(error);
}

export async function list(req, res, next) {
  try {
    const { routeId } = req.query;
    if (routeId) {
      if (!mongoose.isValidObjectId(routeId)) {
        return res.status(400).json({ message: "Invalid route ID." });
      }
      const route = await Route.findById(routeId);
      let stops = await BusStop.find({ routeId }).sort({ sequence: 1 });
      if (route && Array.isArray(route.stops) && route.stops.length) {
        const stopMap = new Map(stops.map((s) => [String(s._id), s]));
        const ordered = [];
        for (const id of route.stops) {
          const s = stopMap.get(String(id));
          if (s) {
            ordered.push(s);
            stopMap.delete(String(id));
          }
        }
        for (const s of stopMap.values()) {
          ordered.push(s);
        }
        stops = ordered;
      }
      return res.json({ stops });
    }
    const stops = await BusStop.find().sort({ routeId: 1, sequence: 1 });
    res.json({ stops });
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Stop name is required." });

    const routeId = body.routeId;
    if (!routeId || !mongoose.isValidObjectId(routeId)) {
      return res.status(400).json({ message: "A valid routeId is required for this stop." });
    }

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({ message: "Selected route not found." });
    }

    const latitude = parseCoordinate(body.latitude, "Latitude", -90, 90);
    const longitude = parseCoordinate(body.longitude, "Longitude", -180, 180);

    const count = await BusStop.countDocuments({ routeId });
    const sequence =
      body.sequence != null && Number.isFinite(Number(body.sequence))
        ? Math.max(1, Math.round(Number(body.sequence)))
        : count + 1;

    const scheduledTime =
      typeof body.scheduledTime === "string" ? body.scheduledTime.trim() : "";

    const stop = await BusStop.create({
      name,
      routeId,
      latitude,
      longitude,
      sequence,
      scheduledTime,
    });

    if (!route.stops.map(String).includes(String(stop._id))) {
      route.stops.push(stop._id);
    }

    if (scheduledTime) {
      const existingTimetableIdx = route.scheduledStops.findIndex(
        (ts) =>
          (ts.stopId && String(ts.stopId) === String(stop._id)) ||
          ts.place?.trim().toLowerCase() === name.toLowerCase(),
      );
      if (existingTimetableIdx >= 0) {
        route.scheduledStops[existingTimetableIdx].time = scheduledTime;
        route.scheduledStops[existingTimetableIdx].place = name;
        route.scheduledStops[existingTimetableIdx].stopId = stop._id;
      } else {
        route.scheduledStops.push({
          place: name,
          time: scheduledTime,
          stopId: stop._id,
        });
      }
    }
    await route.save();

    res.status(201).json({ stop });
  } catch (error) {
    handleStopError(error, next, res);
  }
}

export async function update(req, res, next) {
  try {
    const stop = await BusStop.findById(req.params.id);
    if (!stop) return res.status(404).json({ message: "Stop not found." });

    const body = req.body || {};
    const oldName = stop.name;

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return res.status(400).json({ message: "Stop name cannot be empty." });
      }
      stop.name = body.name.trim();
    }

    if (body.latitude !== undefined) {
      stop.latitude = parseCoordinate(body.latitude, "Latitude", -90, 90);
    }
    if (body.longitude !== undefined) {
      stop.longitude = parseCoordinate(body.longitude, "Longitude", -180, 180);
    }
    if (body.sequence !== undefined && Number.isFinite(Number(body.sequence))) {
      stop.sequence = Math.max(1, Math.round(Number(body.sequence)));
    }
    if (body.scheduledTime !== undefined) {
      stop.scheduledTime =
        typeof body.scheduledTime === "string" ? body.scheduledTime.trim() : "";
    }

    await stop.save();

    if (stop.routeId) {
      const route = await Route.findById(stop.routeId);
      if (route) {
        const timetableIdx = route.scheduledStops.findIndex(
          (ts) =>
            (ts.stopId && String(ts.stopId) === String(stop._id)) ||
            ts.place?.trim().toLowerCase() === oldName.toLowerCase() ||
            ts.place?.trim().toLowerCase() === stop.name.toLowerCase(),
        );
        if (timetableIdx >= 0) {
          route.scheduledStops[timetableIdx].place = stop.name;
          route.scheduledStops[timetableIdx].stopId = stop._id;
          if (stop.scheduledTime) {
            route.scheduledStops[timetableIdx].time = stop.scheduledTime;
          }
          await route.save();
        } else if (stop.scheduledTime) {
          route.scheduledStops.push({
            place: stop.name,
            time: stop.scheduledTime,
            stopId: stop._id,
          });
          await route.save();
        }
      }
    }

    res.json({ stop });
  } catch (error) {
    handleStopError(error, next, res);
  }
}

export async function remove(req, res, next) {
  try {
    const stop = await BusStop.findById(req.params.id);
    if (!stop) return res.status(404).json({ message: "Stop not found." });

    const routeId = stop.routeId;
    const stopName = stop.name;

    await stop.deleteOne();

    if (routeId) {
      const route = await Route.findById(routeId);
      if (route) {
        route.stops = route.stops.filter((id) => String(id) !== String(stop._id));
        route.scheduledStops = route.scheduledStops.filter(
          (ts) =>
            String(ts.stopId || "") !== String(stop._id) &&
            ts.place?.trim().toLowerCase() !== stopName.trim().toLowerCase(),
        );
        await route.save();
      }

      const remaining = await BusStop.find({ routeId }).sort({ sequence: 1 });
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].sequence !== i + 1) {
          remaining[i].sequence = i + 1;
          await remaining[i].save();
        }
      }
    }

    res.json({ message: "Stop deleted successfully." });
  } catch (e) {
    next(e);
  }
}

export async function reorder(req, res, next) {
  try {
    const { routeId, stopIds } = req.body || {};
    if (!routeId || !mongoose.isValidObjectId(routeId)) {
      return res.status(400).json({ message: "A valid routeId is required." });
    }
    if (!Array.isArray(stopIds) || !stopIds.length) {
      return res.status(400).json({ message: "stopIds must be a non-empty array." });
    }

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({ message: "Route not found." });
    }

    const stops = await BusStop.find({ _id: { $in: stopIds }, routeId });
    if (stops.length !== stopIds.length) {
      return res.status(400).json({ message: "One or more stop IDs do not belong to this route." });
    }

    route.stops = stopIds;
    if (Array.isArray(route.scheduledStops) && route.scheduledStops.length) {
      const stopOrderMap = new Map(stopIds.map((id, idx) => [String(id), idx]));
      route.scheduledStops.sort((a, b) => {
        const aIdx = a.stopId && stopOrderMap.has(String(a.stopId)) ? stopOrderMap.get(String(a.stopId)) : 999;
        const bIdx = b.stopId && stopOrderMap.has(String(b.stopId)) ? stopOrderMap.get(String(b.stopId)) : 999;
        return aIdx - bIdx;
      });
    }
    await route.save();

    for (let i = 0; i < stopIds.length; i++) {
      await BusStop.findByIdAndUpdate(stopIds[i], { sequence: i + 1 });
    }

    const updatedStops = await BusStop.find({ routeId }).sort({ sequence: 1 });
    res.json({ success: true, stops: updatedStops });
  } catch (error) {
    handleStopError(error, next, res);
  }
}
