import mongoose from "mongoose";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";

const errorWithStatus = (status, message) =>
  Object.assign(new Error(message), { status });

export async function assignDriverToBus(busId, driverId) {
  if (!mongoose.isValidObjectId(busId)) {
    throw errorWithStatus(400, "Bus ID is invalid.");
  }
  if (driverId && !mongoose.isValidObjectId(driverId)) {
    throw errorWithStatus(400, "Driver ID is invalid.");
  }
  const bus = await Bus.findById(busId);
  if (!bus) throw errorWithStatus(404, "Bus not found.");

  const busKey = String(bus._id);
  const currentDriverId = bus.driverId ? String(bus.driverId) : "";
  const nextDriverId = driverId ? String(driverId) : "";

  if (currentDriverId === nextDriverId) {
    if (!nextDriverId) {
      await User.updateMany(
        { assignedBusId: bus._id },
        { $unset: { assignedBusId: 1 } },
      );
      return bus;
    }
    const driver = await User.findOne({ _id: nextDriverId, role: "driver" });
    if (!driver) throw errorWithStatus(404, "Driver not found.");
    if (driver.isActive === false) {
      throw errorWithStatus(
        409,
        "Activate this driver before assigning a bus.",
      );
    }
    const otherBus = await Bus.findOne({
      driverId: driver._id,
      _id: { $ne: bus._id },
    }).select("busNumber");
    if (otherBus) {
      throw errorWithStatus(
        409,
        `Driver is already assigned to ${otherBus.busNumber}.`,
      );
    }
    await User.updateOne(
      { _id: driver._id },
      { $set: { assignedBusId: bus._id } },
    );
    return bus;
  }

  if (await Trip.exists({ busId: bus._id, status: "active" })) {
    throw errorWithStatus(
      409,
      "Stop the active trip before changing this bus assignment.",
    );
  }

  let driver;
  let previousAssignmentId = "";
  if (nextDriverId) {
    driver = await User.findOne({ _id: nextDriverId, role: "driver" });
    if (!driver) throw errorWithStatus(404, "Driver not found.");
    if (driver.isActive === false) {
      throw errorWithStatus(
        409,
        "Activate this driver before assigning a bus.",
      );
    }

    const otherBus = await Bus.findOne({
      driverId: driver._id,
      _id: { $ne: bus._id },
    }).select("busNumber");
    if (otherBus) {
      throw errorWithStatus(
        409,
        `Driver is already assigned to ${otherBus.busNumber}.`,
      );
    }

    previousAssignmentId = driver.assignedBusId
      ? String(driver.assignedBusId)
      : "";
    if (previousAssignmentId && previousAssignmentId !== busKey) {
      const staleAssignment = await Bus.exists({
        _id: previousAssignmentId,
        driverId: driver._id,
      });
      if (staleAssignment) {
        throw errorWithStatus(
          409,
          "Driver is already assigned to another bus.",
        );
      }
      await User.updateOne(
        { _id: driver._id, assignedBusId: previousAssignmentId },
        { $unset: { assignedBusId: 1 } },
      );
      previousAssignmentId = "";
    }

    const reservation = await User.findOneAndUpdate(
      {
        _id: driver._id,
        role: "driver",
        isActive: { $ne: false },
        $or: [{ assignedBusId: null }, { assignedBusId: bus._id }],
      },
      { $set: { assignedBusId: bus._id } },
      { new: true },
    );
    if (!reservation) {
      throw errorWithStatus(409, "Driver is already assigned to another bus.");
    }
  }

  const busFilter = { _id: bus._id };
  if (currentDriverId) busFilter.driverId = bus.driverId;
  else busFilter.$or = [{ driverId: null }, { driverId: { $exists: false } }];

  const update = nextDriverId
    ? { $set: { driverId: driver._id } }
    : { $unset: { driverId: 1 } };
  const updatedBus = await Bus.findOneAndUpdate(busFilter, update, {
    new: true,
  });
  if (!updatedBus) {
    if (driver && !previousAssignmentId) {
      await User.updateOne(
        { _id: driver._id, assignedBusId: bus._id },
        { $unset: { assignedBusId: 1 } },
      );
    }
    throw errorWithStatus(
      409,
      "Bus assignment changed. Refresh and try again.",
    );
  }

  if (currentDriverId && currentDriverId !== nextDriverId) {
    await User.updateOne(
      { _id: currentDriverId, assignedBusId: bus._id },
      { $unset: { assignedBusId: 1 } },
    );
  }

  return updatedBus;
}
