import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";

const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPhone = (phone) => !phone || /^[+()\d\s.-]{7,32}$/.test(phone);
const publicDriver = (driver) => ({
  _id: driver._id,
  name: driver.name,
  email: driver.email,
  phone: driver.phone,
  role: driver.role,
  isActive: driver.isActive !== false,
  assignedBusId: driver.assignedBusId || null,
  lastLoginAt: driver.lastLoginAt || null,
  createdAt: driver.createdAt,
});

export async function list(req, res, next) {
  try {
    const q = req.query.role ? { role: req.query.role } : {};
    res.json({
      users: await User.find(q)
        .select("-password")
        .populate("assignedStop", "name"),
    });
  } catch (e) {
    next(e);
  }
}

export async function createDriver(req, res, next) {
  const { name, email, password, phone } = req.body || {};
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

  if (
    !normalizedName ||
    !normalizedEmail ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      message: "Name, email, and password are required.",
    });
  }
  if (normalizedName.length > 80) {
    return res
      .status(400)
      .json({ message: "Name must be 80 characters or fewer." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters long.",
    });
  }
  if (phone != null && typeof phone !== "string") {
    return res.status(400).json({ message: "Phone number must be text." });
  }
  if (normalizedPhone && !/^[+()\d\s.-]{7,32}$/.test(normalizedPhone)) {
    return res.status(400).json({ message: "Enter a valid phone number." });
  }

  try {
    if (await User.exists({ email: normalizedEmail })) {
      return res
        .status(409)
        .json({ message: "That email is already registered." });
    }

    const driver = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      phone: normalizedPhone || undefined,
      role: "driver",
    });

    res.status(201).json({
      user: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        role: driver.role,
        phone: driver.phone,
        assignedBusId: driver.assignedBusId,
        createdAt: driver.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "That email is already registered." });
    }
    next(error);
  }
}

export async function listDrivers(req, res, next) {
  try {
    const drivers = await User.find({ role: "driver" })
      .select("-password")
      .sort({ name: 1 });
    const driverIds = drivers.map((driver) => driver._id);
    const assignedBusIds = drivers
      .map((driver) => driver.assignedBusId)
      .filter(Boolean);
    const [buses, trips] = await Promise.all([
      Bus.find({
        $or: [
          { driverId: { $in: driverIds } },
          { _id: { $in: assignedBusIds } },
        ],
      })
        .select(
          "busNumber registrationNumber routeId driverId status lastUpdated currentLocation",
        )
        .populate("routeId", "name"),
      Trip.find({ driverId: { $in: driverIds } })
        .select("driverId busId routeId status startedAt endedAt")
        .populate("busId", "busNumber")
        .populate("routeId", "name")
        .sort({ startedAt: -1 }),
    ]);

    const busByDriver = new Map();
    for (const bus of buses) {
      if (bus.driverId) busByDriver.set(String(bus.driverId), bus);
    }
    for (const driver of drivers) {
      if (!busByDriver.has(String(driver._id)) && driver.assignedBusId) {
        const assignedBus = buses.find(
          (bus) => String(bus._id) === String(driver.assignedBusId),
        );
        if (assignedBus) busByDriver.set(String(driver._id), assignedBus);
      }
    }

    const tripsByDriver = new Map();
    for (const trip of trips) {
      const driverKey = String(trip.driverId);
      const driverTrips = tripsByDriver.get(driverKey) || [];
      driverTrips.push(trip);
      tripsByDriver.set(driverKey, driverTrips);
    }

    const result = drivers.map((driver) => {
      const driverTrips = tripsByDriver.get(String(driver._id)) || [];
      const currentTrip =
        driverTrips.find((trip) => trip.status === "active") || null;
      const assignedBus = busByDriver.get(String(driver._id)) || null;
      const lastTrip = driverTrips[0] || null;
      const activityDates = [
        driver.lastLoginAt,
        assignedBus?.lastUpdated,
        assignedBus?.currentLocation?.timestamp,
        lastTrip?.endedAt,
        lastTrip?.startedAt,
      ].filter(Boolean);
      const lastActivityAt = activityDates.length
        ? new Date(
            Math.max(...activityDates.map((date) => new Date(date).getTime())),
          )
        : null;

      return {
        ...publicDriver(driver),
        assignedBus: assignedBus
          ? {
              _id: assignedBus._id,
              busNumber: assignedBus.busNumber,
              registrationNumber: assignedBus.registrationNumber,
              status: assignedBus.status,
            }
          : null,
        assignedRoute: assignedBus?.routeId || null,
        currentTrip: currentTrip
          ? {
              _id: currentTrip._id,
              status: currentTrip.status,
              startedAt: currentTrip.startedAt,
              bus: currentTrip.busId,
              route: currentTrip.routeId,
            }
          : null,
        hasTripHistory: driverTrips.length > 0,
        lastActivityAt,
      };
    });

    res.json({ drivers: result });
  } catch (error) {
    next(error);
  }
}

export async function updateDriver(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Driver ID is invalid." });
    }
    const driver = await User.findOne({ _id: req.params.id, role: "driver" });
    if (!driver) return res.status(404).json({ message: "Driver not found." });

    const { name, email, phone } = req.body || {};
    const updates = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
        return res
          .status(400)
          .json({ message: "Enter a name up to 80 characters long." });
      }
      updates.name = name.trim();
    }
    if (email !== undefined) {
      if (typeof email !== "string" || !validEmail(email.trim())) {
        return res
          .status(400)
          .json({ message: "Enter a valid email address." });
      }
      updates.email = email.trim().toLowerCase();
      if (
        await User.exists({
          email: updates.email,
          _id: { $ne: driver._id },
        })
      ) {
        return res
          .status(409)
          .json({ message: "That email is already registered." });
      }
    }
    if (phone !== undefined) {
      if (phone !== null && typeof phone !== "string") {
        return res.status(400).json({ message: "Phone number must be text." });
      }
      updates.phone = typeof phone === "string" ? phone.trim() : "";
      if (!validPhone(updates.phone)) {
        return res.status(400).json({ message: "Enter a valid phone number." });
      }
    }
    if (!Object.keys(updates).length) {
      return res
        .status(400)
        .json({ message: "Provide at least one driver detail to update." });
    }

    Object.assign(driver, updates);
    await driver.save();
    res.json({ user: publicDriver(driver) });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "That email is already registered." });
    }
    next(error);
  }
}

export async function updateDriverStatus(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Driver ID is invalid." });
    }
    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ message: "Account status must be active or inactive." });
    }
    const driver = await User.findOne({ _id: req.params.id, role: "driver" });
    if (!driver) return res.status(404).json({ message: "Driver not found." });
    if (
      !isActive &&
      (await Trip.exists({ driverId: driver._id, status: "active" }))
    ) {
      return res
        .status(409)
        .json({
          message:
            "End the driver's active trip before deactivating the account.",
        });
    }
    driver.isActive = isActive;
    await driver.save();
    res.json({ user: publicDriver(driver) });
  } catch (error) {
    next(error);
  }
}

export async function resetDriverPassword(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Driver ID is invalid." });
    }
    const { password } = req.body || {};
    if (typeof password !== "string" || password.trim().length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long." });
    }
    const driver = await User.findOne({
      _id: req.params.id,
      role: "driver",
    }).select("+password");
    if (!driver) return res.status(404).json({ message: "Driver not found." });
    driver.password = await bcrypt.hash(password, 12);
    await driver.save();
    res.json({ message: "Driver password updated." });
  } catch (error) {
    next(error);
  }
}

export async function deleteDriver(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Driver ID is invalid." });
    }
    const driver = await User.findOne({ _id: req.params.id, role: "driver" });
    if (!driver) return res.status(404).json({ message: "Driver not found." });
    if (driver.isActive !== false) {
      return res
        .status(409)
        .json({
          message: "Deactivate the driver before deleting the account.",
        });
    }
    if (await Trip.exists({ driverId: driver._id, status: "active" })) {
      return res
        .status(409)
        .json({ message: "A driver with an active trip cannot be deleted." });
    }
    if (driver.assignedBusId || (await Bus.exists({ driverId: driver._id }))) {
      return res
        .status(409)
        .json({
          message:
            "Unassign the driver from their bus before deleting the account.",
        });
    }
    if (await Trip.exists({ driverId: driver._id })) {
      return res
        .status(409)
        .json({
          message:
            "This driver has trip history. Deactivate the account instead to preserve records.",
        });
    }
    await driver.deleteOne();
    res.json({ message: "Driver account deleted." });
  } catch (error) {
    next(error);
  }
}
