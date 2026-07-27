import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

export function apiKeyAuth(req, res, next) {
  const dashboardKey = process.env.BACKEND_API_KEY;
  const systemKey = process.env.SYSTEM_API_KEY;
  const allowUnauthenticatedDev = process.env.ALLOW_UNAUTHENTICATED_DEV === "true";

  if (!dashboardKey) {
    if (allowUnauthenticatedDev) {
      return next();
    }
    return res
      .status(500)
      .json({ success: false, message: "Server tidak terkonfigurasi dengan benar (BACKEND_API_KEY belum di-set)." });
  }

  const providedKey = req.header("X-API-Key");

  if (!providedKey) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  if (safeEqual(providedKey, dashboardKey)) {
    req.apiClient = "dashboard";
    return next();
  }

  if (systemKey && safeEqual(providedKey, systemKey)) {
    req.apiClient = "system";
    return next();
  }

  return res.status(401).json({ success: false, message: "Unauthorized." });
}
