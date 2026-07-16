/**
 * Autentikasi sederhana berbasis API key (header `X-API-Key`).
 *
 * Ini BUKAN pengganti sistem login/SSO yang proper -- untuk aplikasi
 * internal seperti ini, tujuannya adalah mencegah orang random yang
 * nemu URL backend kamu bisa langsung nge-spam WhatsApp/nulis ke
 * database tanpa izin. Kalau nanti butuh multi-user dengan hak akses
 * berbeda-beda, ini perlu diupgrade ke JWT/session per-user.
 *
 * FAIL-CLOSED: kalau BACKEND_API_KEY tidak di-set, middleware ini
 * MENOLAK seluruh request (bukan meloloskannya). server.js sudah
 * mencegah proses ini start sama sekali tanpa BACKEND_API_KEY, jadi
 * cabang ini seharusnya tidak pernah tercapai di jalur normal --
 * pengecekan di sini murni defense-in-depth.
 *
 * Satu-satunya cara melewati proteksi ini adalah dengan sengaja
 * mengisi ALLOW_UNAUTHENTICATED_DEV=true di .env, khusus development
 * lokal. JANGAN pernah set ini di staging/production.
 */
export function apiKeyAuth(req, res, next) {
  const expectedKey = process.env.BACKEND_API_KEY;
  const allowUnauthenticatedDev = process.env.ALLOW_UNAUTHENTICATED_DEV === "true";

  if (!expectedKey) {
    if (allowUnauthenticatedDev) {
      return next();
    }
    return res
      .status(500)
      .json({ success: false, message: "Server tidak terkonfigurasi dengan benar (BACKEND_API_KEY belum di-set)." });
  }

  const providedKey = req.header("X-API-Key");

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  return next();
}
