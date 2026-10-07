import BusStop from "../models/BusStop.js";

function coordinate(value, label, min, max) {
  const parsed =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : value;
  if (
    typeof parsed !== "number" ||
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max
  ) {
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
    return res.status(400).json({ message: "Stop name, coordinates, or sequence are invalid." });
  }
  next(error);
}

export async function list(req, res, next) {
  try {
    res.json({ stops: await BusStop.find().sort({ sequence: 1 }) });
  } catch (e) {
    next(e);
  }
}
export async function create(req, res, next) {
  try {
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Stop name is required." });
    const stop = await BusStop.create({
      name,
      latitude: coordinate(body.latitude, "Latitude", -90, 90),
      longitude: coordinate(body.longitude, "Longitude", -180, 180),
      sequence: body.sequence,
    });
    res.status(201).json({ stop });
  } catch (error) {
    handleStopError(error, next, res);
  }
}
export async function update(req, res, next) {
  try {
    const stop = await BusStop.findById(req.params.id);
    if (!stop) return res.status(404).json({ message: "Stop not found" });
    const body = req.body || {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return res.status(400).json({ message: "Stop name is required." });
      }
      stop.name = body.name.trim();
    }
    stop.latitude = coordinate(body.latitude ?? stop.latitude, "Latitude", -90, 90);
    stop.longitude = coordinate(body.longitude ?? stop.longitude, "Longitude", -180, 180);
    if (body.sequence !== undefined) stop.sequence = body.sequence;
    await stop.save();
    res.json({ stop });
  } catch (error) {
    handleStopError(error, next, res);
  }
}
export async function remove(req, res, next) {
  try {
    await BusStop.findByIdAndDelete(req.params.id);
    res.json({ message: "Stop deleted" });
  } catch (e) {
    next(e);
  }
}
