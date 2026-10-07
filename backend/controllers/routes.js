import Route from "../models/Route.js";
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
    const route = await Route.create(req.body);
    res.status(201).json({ route });
  } catch (e) {
    next(e);
  }
}
export async function update(req, res, next) {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
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
