import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, 
  limit: 60, 
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/send-message",
  message: { success: false, message: "Terlalu banyak request, coba lagi sebentar lagi." },
});

export const enqueueLimiter = rateLimit({
  windowMs: 60 * 1000, 
  limit: Number(process.env.ENQUEUE_RATE_LIMIT_PER_MINUTE) || 2000, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan pengiriman pesan dalam waktu singkat, coba lagi sebentar lagi.",
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan login, coba lagi sebentar lagi.",
  },
});
