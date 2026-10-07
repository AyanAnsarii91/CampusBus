import mongoose from "mongoose";
import BusStop from "../models/BusStop.js";
import Route from "../models/Route.js";

async function validateRouteStops(stops) {
  if (!Array.isArray(stops)) {
    throw Object.assign(new Error("Route stops must be an ordered list."), {
      status: 400,
    });
  }
  if (!stops.length) return [];
  if (stops.some((stopId) => !mongoose.isValidObjectId(stopId))) {
    throw Object.assign(new Error("One or more route stop IDs are invalid."), {
      status: 400,
    });
  }
  const ids = stops.map(String);
  if (new Set(ids).size !== ids.length) {
    throw Object.assign(new Error("A route cannot contain the same stop more than once."), {
      status: 400,
    });
  }

  const records = await BusStop.find({ _id: { $in: ids } }).select(
    "_id latitude longitude",
  );
  if (records.length !== ids.length) {
    throw Object.assign(new Error("One or more selected route stops do not exist."), {
      status: 400,
    });
  }
  if (
    records.some(
      (stop) =>
        !Number.isFinite(stop.latitude) ||
        stop.latitude < -90 ||
        stop.latitude > 90 ||
        !Number.isFinite(stop.longitude) ||
        stop.longitude < -180 ||
        stop.longitude > 180,
    )
  ) {
    throw Object.assign(
      new Error("Every route stop must have valid latitude and longitude."),
      { status: 400 },
    );
  }
  const recordsById = new Map(records.map((stop) => [String(stop._id), stop]));
  return ids.map((id) => recordsById.get(id)._id);
}
export async function list(req, res, next) {
  try {
    const routes = await Route.find().populate({
      path: "stops",
      options: { sort: { sequence: 1 } },
    });
    res.json({ routes });
  } catch (e) {
    next(e);
  }
}
export async function get(req, res, next) {
  try {
    const route = await Route.findById(req.params.id).populate({
      path: "stops",
      options: { sort: { sequence: 1 } },
    });
    if (!route) return res.status(404).json({ message: "Route not found" });
    res.json({ route });
  } catch (e) {
    next(e);
  }
}
export async function create(req, res, next) {
  try {
    const body = req.body || {};
    const stops = await validateRouteStops(body.stops || []);
    const route = await Route.create({ ...body, stops });
    res.status(201).json({ route });
  } catch (e) {
    next(e);
  }
}
export async function update(req, res, next) {
  try {
    const body = req.body || {};
    const updates = { ...body };
    if (Object.hasOwn(body, "stops")) {
      updates.stops = await validateRouteStops(body.stops);
    }
    const route = await Route.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!route) return res.status(404).json({ message: "Route not found" });
    res.json({ route });
  } catch (e) {
    next(e);
  }
}
export async function remove(req, res, next) {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ message: "Route deleted" });
  } catch (e) {
    next(e);
  }
}
