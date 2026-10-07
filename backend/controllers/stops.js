import BusStop from "../models/BusStop.js";
export async function list(req, res, next) {
  try {
    res.json({ stops: await BusStop.find().sort({ sequence: 1 }) });
  } catch (e) {
    next(e);
  }
}
export async function create(req, res, next) {
  try {
    res.status(201).json({ stop: await BusStop.create(req.body) });
  } catch (e) {
    next(e);
  }
}
export async function update(req, res, next) {
  try {
    const stop = await BusStop.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!stop) return res.status(404).json({ message: "Stop not found" });
    res.json({ stop });
  } catch (e) {
    next(e);
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
