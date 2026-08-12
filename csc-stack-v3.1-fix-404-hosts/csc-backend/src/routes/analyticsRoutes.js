import { Router } from "express";
import { handleGetOverview } from "../controllers/analyticsController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/analytics/overview", asyncHandler(handleGetOverview));

export default router;
