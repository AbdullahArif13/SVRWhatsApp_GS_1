export function requireLogin(req, res, next) {
  if (!req.session?.adminId) {
    return res.status(401).json({ success: false, message: "Sesi login tidak ditemukan/sudah berakhir. Silakan login ulang." });
  }
  return next();
}
