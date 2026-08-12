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
