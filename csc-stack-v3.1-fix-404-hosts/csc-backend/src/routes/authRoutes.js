import { Router } from "express";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleListSessions,
  handleDeleteSession,
} from "../controllers/authController.js";
import { requireLogin } from "../middleware/requireLogin.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/auth/login", authLimiter, asyncHandler(handleLogin));
router.post("/auth/logout", requireLogin, handleLogout);
router.get("/auth/me", requireLogin, handleMe);



router.get("/auth/sessions", requireRole("super_admin", "admin"), asyncHandler(handleListSessions));
router.delete("/auth/sessions/:sid", requireRole("super_admin"), asyncHandler(handleDeleteSession));

export default router;
