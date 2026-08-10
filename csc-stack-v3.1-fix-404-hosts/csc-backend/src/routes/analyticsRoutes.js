import { Router } from "express";
import { handleGetOverview } from "../controllers/analyticsController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// v3.11: SENGAJA TIDAK ada requireLogin/requireRole di sini -- apiKeyAuth
// (sudah global di server.js) saja cukup. Ini yang memungkinkan role
// 'pengguna' (read-only, cuma boleh lihat Dashboard) tetap bisa akses,
// SEKALIGUS integrasi eksternal yang cuma dikasih X-API-Key (tanpa login
// dashboard sama sekali) bisa langsung pakai data yang sama untuk bikin
// tampilan mereka sendiri.
router.get("/analytics/overview", asyncHandler(handleGetOverview));

export default router;
