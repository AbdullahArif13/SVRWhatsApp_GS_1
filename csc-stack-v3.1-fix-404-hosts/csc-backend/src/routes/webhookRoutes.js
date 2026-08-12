import { Router } from "express";
import { handleWhatsAppWebhook } from "../controllers/webhookController.js";
import { verifyGowaWebhookSignature } from "../middleware/verifyGowaWebhookSignature.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.post("/webhooks/whatsapp", verifyGowaWebhookSignature, asyncHandler(handleWhatsAppWebhook));

export default router;
