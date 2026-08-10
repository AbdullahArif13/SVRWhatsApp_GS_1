import { Router } from "express";
import { handleWhatsAppWebhook } from "../controllers/webhookController.js";
import { verifyGowaWebhookSignature } from "../middleware/verifyGowaWebhookSignature.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// PENTING: route ini SENGAJA tidak dipasang di bawah "/api" + apiKeyAuth
// (lihat server.js) -- yang memanggil endpoint ini adalah container GOWA
// (server-to-server), bukan dashboard, dan otentikasinya BUKAN X-API-Key
// tapi HMAC signature (header X-Hub-Signature-256, lihat
// verifyGowaWebhookSignature.js).
router.post("/webhooks/whatsapp", verifyGowaWebhookSignature, asyncHandler(handleWhatsAppWebhook));

export default router;
