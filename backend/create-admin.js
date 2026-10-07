import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";

let exitCode = 0;

try {
  await connectDB();
  const existingAdmin = await User.exists({
    role: "admin",
    isActive: { $ne: false },
  });
  if (existingAdmin) {
    console.log("An admin account already exists. No changes were made.");
  } else {
    const name = process.env.ADMIN_NAME?.trim();
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error(
        "Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this command.",
      );
    }
    if (name.length > 80) {
      throw new Error("ADMIN_NAME must be 80 characters or fewer.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("ADMIN_EMAIL must be a valid email address.");
    }
    if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
    }
    if (await User.exists({ email })) {
      throw new Error("That email is already in use by a non-admin account.");
    }

    await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: "admin",
      isActive: true,
    });
    console.log(`Admin account created for ${email}.`);
  }
} catch (error) {
  console.error(error.message || "Admin provisioning failed.");
  exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = exitCode;
