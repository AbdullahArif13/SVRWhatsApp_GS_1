/**
 * Gerbang ROLE (v3.11) -- dipasang SETELAH requireLogin (butuh
 * req.session.adminId sudah ada), membatasi endpoint tertentu cuma boleh
 * diakses role tertentu.
 *
 * PENTING -- endpoint yang JUGA dipanggil integrasi sistem eksternal
 * murni lewat X-API-Key (mis. POST /api/send-message) SENGAJA TIDAK
 * dipasangi gerbang ini, supaya integrasi itu tidak ikut ke-blok gara-gara
 * tidak punya sesi login/role sama sekali. Ini HANYA untuk endpoint yang
 * memang dashboard-only (Template CRUD dari UI, Manage User, Sesi Login).
 */
export function requireRole(...allowedRoles) {
  return function roleGate(req, res, next) {
    if (!req.session?.adminId) {
      return res.status(401).json({ success: false, message: "Sesi login tidak ditemukan/sudah berakhir. Silakan login ulang." });
    }
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({ success: false, message: "Kamu tidak punya izin untuk mengakses fitur ini." });
    }
    return next();
  };
}
