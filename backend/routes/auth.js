import { Router } from "express";
import { register, login, me } from "../controllers/auth.js";
import { requireAuth } from "../middleware/auth.js";
const r = Router();
r.post("/register", register);
r.post("/login", login);
r.post("/logout", (req, res) => res.json({ message: "Logged out" }));
r.get("/me", requireAuth, me);
export default r;
