import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const tokenFor = (u) =>
  jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
const safe = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  studentId: u.studentId,
  assignedStop: u.assignedStop,
  assignedBusId: u.assignedBusId,
});
export async function register(req, res, next) {
  try {
    const { name, email, password, studentId } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    if (await User.exists({ email }))
      return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      studentId,
      role: "student",
    });
    res.status(201).json({ token: tokenFor(user), user: safe(user) });
  } catch (e) {
    next(e);
  }
}
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password || "", user.password)))
      return res.status(401).json({ message: "Invalid email or password" });
    if (user.isActive === false) {
      return res.status(403).json({ message: "This account has been deactivated. Contact an administrator." });
    }
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: tokenFor(user), user: safe(user) });
  } catch (e) {
    next(e);
  }
}
export async function me(req, res) {
  res.json({ user: safe(req.user) });
}
