import rateLimit from "express-rate-limit";

/**
 * Rate limit umum untuk semua endpoint /api -- mencegah brute-force /
 * flood request biasa.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  limit: 60, // maksimal 60 request/menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak request, coba lagi sebentar lagi." },
});

/**
 * Rate limit KHUSUS dan lebih ketat untuk /api/send-message, karena ini
 * endpoint yang paling berbahaya kalau disalahgunakan (bisa dipakai buat
 * nge-spam WhatsApp orang / kena banned WhatsApp Business).
 */
export const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  limit: 50, // maksimal 50 pesan/menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan kirim pesan, coba lagi sebentar lagi.",
  },
});
