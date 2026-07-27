import rateLimit from "express-rate-limit";

/**
 * Rate limit umum untuk semua endpoint /api -- mencegah brute-force /
 * flood request biasa.
 *
 * v3.4: /send-message DIKECUALIKAN dari limiter ini (lihat `skip` di
 * bawah) -- endpoint itu sekarang justru DIRANCANG buat nerima banyak
 * request sekaligus (lihat services/queueService.js), jadi kalau tetap
 * kena limit 60/menit ini, batasan 60/menit-nya bakal nyekek DUA KALI
 * (di sini DAN lagi di enqueueLimiter di bawah) padahal maksudnya beda.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  limit: 60, // maksimal 60 request/menit per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/send-message",
  message: { success: false, message: "Terlalu banyak request, coba lagi sebentar lagi." },
});

/**
 * Rate limit khusus /api/send-message -- BUKAN lagi buat membatasi
 * seberapa cepat pesan keluar ke WhatsApp (itu sekarang tugas
 * queueService.js, lihat QUEUE_RATE_LIMIT_PER_MINUTE), tapi murni jaga-jaga
 * DoS di sisi PENERIMAAN request: mencegah ada yang sengaja ngirim
 * jutaan request sekaligus yang bisa membanjiri memori/DB, sambil tetap
 * mengizinkan lonjakan wajar (ribuan request) yang jadi alasan endpoint
 * ini diubah jadi antrian.
 */
export const enqueueLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  limit: Number(process.env.ENQUEUE_RATE_LIMIT_PER_MINUTE) || 2000, // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan pengiriman pesan dalam waktu singkat, coba lagi sebentar lagi.",
  },
});
