import crypto from "crypto";

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
