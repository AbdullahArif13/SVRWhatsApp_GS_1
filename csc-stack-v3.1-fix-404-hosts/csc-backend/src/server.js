import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import messageRoutes from "./routes/messageRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { initQueueFromDatabase } from "./services/queueService.js";
import { pool } from "./db.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin tidak diizinkan oleh CORS."));
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "100kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET,
    name: "csc_session",
    resave: false,
    saveUninitialized: false,
    
    
    
    rolling: true,
    cookie: {
      httpOnly: true,
      
      
      
      secure: false,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, 
    },
  })
);

app.use("/api", webhookRoutes);
app.use("/api", generalLimiter);
app.use("/api", apiKeyAuth);
app.use("/api", messageRoutes);
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", analyticsRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "csc-dashboard-backend" });
});

app.use((err, _req, res, _next) => {
   if (err instanceof multer.MulterError || /^Field 'foto' harus berupa/.test(err?.message ?? "")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error("[unhandled error]", err?.message ?? err);
  res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
});

const allowUnauthenticatedDev = process.env.ALLOW_UNAUTHENTICATED_DEV === "true";

if (!process.env.BACKEND_API_KEY && !allowUnauthenticatedDev) {
  console.error(
    "[FATAL] BACKEND_API_KEY belum di-set. Server TIDAK dijalankan supaya endpoint /api/* " +
      "tidak pernah terbuka tanpa proteksi secara default.\n" +
      "  - Isi BACKEND_API_KEY di .env untuk produksi, ATAU\n" +
      "  - Set ALLOW_UNAUTHENTICATED_DEV=true secara eksplisit HANYA untuk development lokal."
  );
  process.exit(1);
}

if (!process.env.BACKEND_API_KEY && allowUnauthenticatedDev) {
  console.warn(
    "[PERINGATAN] ALLOW_UNAUTHENTICATED_DEV=true -- endpoint /api/* TIDAK terlindungi API key sama sekali. " +
      "Mode ini HANYA untuk development lokal, jangan pernah dipakai di staging/production."
  );
}

if (!process.env.SESSION_SECRET) {
  console.error(
    "[FATAL] SESSION_SECRET belum di-set. Server TIDAK dijalankan supaya cookie sesi login Admin " +
      "tidak pernah ditandatangani pakai secret kosong/bisa ditebak.\n" +
      "  - Isi SESSION_SECRET di csc-backend/.env dengan string acak (mis. `openssl rand -base64 32`)."
  );
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
initQueueFromDatabase()
  .catch((error) => {
    console.error("[server] Gagal memuat ulang antrian dari database:", error?.message ?? error);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server jalan di http://localhost:${PORT}`);
    });
  });
