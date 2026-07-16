import crypto from "crypto";

/**
 * Middleware Express khusus untuk route webhook GOWA: menangkap raw body
 * (dibutuhkan untuk verifikasi HMAC, TIDAK BOLEH pakai express.json() biasa
 * di sini karena body sudah harus mentah/belum di-parse pas dihitung
 * signature-nya) sekaligus memverifikasi header `X-Hub-Signature-256`
 * sesuai dokumentasi GOWA:
 *   https://github.com/aldinokemal/go-whatsapp-web-multidevice (docs/webhook-payload.md)
 *
 * Kalau WHATSAPP_WEBHOOK_SECRET belum di-set di .env, verifikasi DILEWATI
 * (supaya gampang dites lokal) -- sama seperti pola apiKeyAuth.js yang
 * sudah ada, tapi WARNING dicetak di log server.
 */
export function verifyGowaWebhookSignature(req, res, next) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const rawBody = req.rawBody ?? "";

  if (!secret) {
    console.warn(
      "[webhook] PERINGATAN: WHATSAPP_WEBHOOK_SECRET belum di-set -- signature webhook TIDAK diverifikasi. " +
        "Jangan expose endpoint /api/webhooks/whatsapp ke internet publik sebelum ini diisi."
    );
    return next();
  }

  const signatureHeader = req.get("X-Hub-Signature-256") || "";
  const receivedSignature = signatureHeader.replace(/^sha256=/, "");

  if (!receivedSignature) {
    return res.status(401).json({ success: false, message: "Header X-Hub-Signature-256 tidak ada." });
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(receivedSignature, "hex"));
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return res.status(401).json({ success: false, message: "Signature webhook tidak valid." });
  }

  return next();
}
