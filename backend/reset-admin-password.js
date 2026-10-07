import "dotenv/config";
import bcrypt from "bcryptjs";
import { stdin, stdout } from "node:process";
import readline from "node:readline/promises";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function promptEmail() {
  if (!stdin.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }
  const terminal = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await terminal.question("Admin email: ")).trim().toLowerCase();
  } finally {
    terminal.close();
  }
}

function promptHiddenPassword(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return Promise.reject(
      new Error("Run this command in an interactive terminal that supports hidden input."),
    );
  }

  return new Promise((resolve, reject) => {
    let password = "";
    const wasPaused = stdin.isPaused();
    const wasRaw = stdin.isRaw;

    const finish = (callback, result) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(wasRaw);
      if (wasPaused) stdin.pause();
      stdout.write("\n");
      callback(result);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(reject, new Error("Password reset cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(resolve, password);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = Array.from(password).slice(0, -1).join("");
          continue;
        }
        if (character >= " ") password += character;
      }
    };

    try {
      stdin.setRawMode(true);
      stdin.setEncoding("utf8");
      stdin.resume();
      stdin.on("data", onData);
      stdout.write(prompt);
    } catch (error) {
      finish(reject, error);
    }
  });
}

let exitCode = 0;

try {
  const email = await promptEmail();
  if (!emailPattern.test(email)) {
    throw new Error("Enter a valid admin email address.");
  }

  const password = await promptHiddenPassword("New password (minimum 8 characters): ");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  await connectDB();
  const filter = {
    email,
    role: "admin",
    isActive: { $ne: false },
  };
  const admin = await User.findOne(filter).select("_id");
  if (!admin) {
    throw new Error("No active admin account exists with that email.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne(
    { ...filter, _id: admin._id },
    { $set: { password: passwordHash } },
    { timestamps: false },
  );
  if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
    throw new Error("The admin account was not updated. No other data was changed.");
  }

  console.log("Admin password updated successfully.");
} catch (error) {
  console.error(error.message || "Admin password reset failed.");
  exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = exitCode;
