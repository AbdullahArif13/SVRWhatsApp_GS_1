/**
 * Autentikasi sederhana berbasis API key (header `X-API-Key`).
 *
 * Ini BUKAN pengganti sistem login/SSO yang proper -- untuk aplikasi
 * internal seperti ini, tujuannya adalah mencegah orang random yang
 * nemu URL backend kamu bisa langsung nge-spam WhatsApp/nulis ke
 * database tanpa izin. Kalau nanti butuh multi-user dengan hak akses
 * berbeda-beda, ini perlu diupgrade ke JWT/session per-user.
 *
 * Ada DUA key independen yang diterima, supaya masing-masing caller
 * bisa di-revoke/diganti sendiri-sendiri tanpa saling ganggu:
 *   - BACKEND_API_KEY -> dipakai csc-dashboard (browser). Nilai ini
 *     nempel di hasil build frontend dan BISA DILIHAT SIAPA SAJA lewat
 *     DevTools -- fungsinya cuma nyaring bot/scanner acak, BUKAN rahasia.
 *   - SYSTEM_API_KEY   -> dipakai integrasi server-to-server (sistem
 *     eksternal yang manggil backend ini langsung, bukan lewat
 *     dashboard/browser). Key ini SUNGGUHAN rahasia -- hardcode/simpan
 *     cuma di sisi server pemanggil, JANGAN PERNAH ditaruh di kode yang
 *     jalan di browser. Opsional: kalau tidak di-set, integrasi via
 *     key ini otomatis nonaktif (cuma BACKEND_API_KEY yang berlaku).
 *
 * Kedua key diberi akses yang SAMA PERSIS ke seluruh endpoint /api/*
 * (tidak ada pembedaan hak akses antar key saat ini).
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
import { timingSafeEqual } from "node:crypto";

/**
 * Bandingkan dua string API key dengan waktu konstan (tidak bocor info
 * lewat timing attack), tapi tetap aman dipanggil walau panjangnya beda
 * (early-return `false`, bukan throw, kalau langsung dibandingkan
 * timingSafeEqual dengan panjang buffer berbeda akan melempar error).
 */
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
