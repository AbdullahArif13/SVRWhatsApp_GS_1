import { Router } from "express";
import { handleListUsers, handleCreateUser, handleGetUserActivity } from "../controllers/usersController.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get("/users", requireRole("super_admin", "admin"), asyncHandler(handleListUsers));
router.post("/users", requireRole("super_admin", "admin"), asyncHandler(handleCreateUser));
router.get("/users/:id/activity", requireRole("super_admin", "admin"), asyncHandler(handleGetUserActivity));

export default router;
