/**
 * Gerbang LOGIN SESSION (v3.10) -- BEDA dari apiKeyAuth.js.
 *
 * apiKeyAuth (X-API-Key) tetap jalan seperti biasa untuk SEMUA endpoint
 * /api/* (termasuk /api/send-message, /api/templates, dst) -- ini yang
 * dipakai integrasi sistem eksternal (SYSTEM_API_KEY) DAN dashboard
 * (BACKEND_API_KEY), TIDAK diubah sama sekali oleh fitur login ini.
 *
 * requireLogin ini HANYA dipasang di endpoint /api/auth/* yang memang
 * butuh Admin sudah login (logout, lihat daftar sesi) -- ini gerbang
 * TAMBAHAN yang mengontrol siapa boleh MEMBUKA dashboard-nya (manusia di
 * browser), bukan pengganti apiKeyAuth.
 */
export function requireLogin(req, res, next) {
  if (!req.session?.adminId) {
    return res.status(401).json({ success: false, message: "Sesi login tidak ditemukan/sudah berakhir. Silakan login ulang." });
  }
  return next();
}
