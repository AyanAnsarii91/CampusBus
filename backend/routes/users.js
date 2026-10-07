import { Router } from "express";
import {
	createDriver,
	deleteDriver,
	list,
	listDrivers,
	resetDriverPassword,
	updateDriver,
	updateDriverStatus,
} from "../controllers/users.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
const r = Router();
r.use(requireAuth, requireRole("admin"));
r.get("/drivers", listDrivers);
r.patch("/drivers/:id", updateDriver);
r.patch("/drivers/:id/status", updateDriverStatus);
r.patch("/drivers/:id/password", resetDriverPassword);
r.delete("/drivers/:id", deleteDriver);
r.get("/", list);
r.post("/drivers", createDriver);
export default r;
