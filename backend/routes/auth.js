import { Router } from "express";
import multer from "multer";
import {
  register,
  login,
  me,
  firebaseAuth,
  updateProfile,
  uploadPhoto,
  deletePhoto,
} from "../controllers/auth.js";
import { requireAuth } from "../middleware/auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

const r = Router();
r.post("/register", register);
r.post("/login", login);
r.post("/firebase", firebaseAuth);
r.post("/logout", (req, res) => res.json({ message: "Logged out" }));
r.get("/me", requireAuth, me);
r.put("/profile", requireAuth, updateProfile);
r.post("/profile/photo", requireAuth, upload.single("photo"), uploadPhoto);
r.delete("/profile/photo", requireAuth, deletePhoto);

export default r;
