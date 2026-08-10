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

// authLimiter dipasang KHUSUS di /login (bukan lewat generalLimiter yang
// sudah ada di server.js) -- mencegah brute-force nebak password, jauh
// lebih ketat daripada limit endpoint biasa. Lihat middleware/rateLimiter.js.
router.post("/auth/login", authLimiter, asyncHandler(handleLogin));
router.post("/auth/logout", requireLogin, handleLogout);
router.get("/auth/me", handleMe);
// v3.11: lihat daftar sesi -- role 'pengguna' TIDAK boleh (cuma boleh
// akses Dashboard). Super Admin & Admin sama-sama boleh MELIHAT (memantau),
// tapi cuma Super Admin yang boleh PAKSA-LOGOUT (lihat route DELETE di bawah).
router.get("/auth/sessions", requireRole("super_admin", "admin"), asyncHandler(handleListSessions));
router.delete("/auth/sessions/:sid", requireRole("super_admin"), asyncHandler(handleDeleteSession));

export default router;
