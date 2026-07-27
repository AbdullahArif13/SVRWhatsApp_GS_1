import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import messageRoutes from "./routes/messageRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { initQueueFromDatabase } from "./services/queueService.js";

const app = express();

// Kalau backend ini nanti jalan di belakang reverse proxy (nginx, dsb),
// baris ini bikin express baca IP asli pengunjung dari header
// X-Forwarded-For -- penting supaya rate limiter di atas ngitung per
// pengunjung asli, bukan cuma per-IP reverse proxy.
app.set("trust proxy", 1);

// Security headers standar (nonaktifin X-Powered-By, cegah clickjacking,
// MIME sniffing, dll).
app.use(helmet());

// CORS dibatasi cuma ke origin yang diizinkan lewat .env (CORS_ORIGIN,
// pisahkan dengan koma kalau lebih dari satu). Kalau tidak di-set,
// default ke origin dashboard dev (localhost:5173) SAJA -- bukan "*".
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Request tanpa "origin" (mis. dari curl/Postman) tetap diizinkan,
      // karena endpoint ini juga dipanggil dari sistem lain (server-to-server),
      // bukan cuma dari browser dashboard.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin tidak diizinkan oleh CORS."));
    },
  })
);

app.use(
  express.json({
    limit: "100kb",
    // Simpan raw body mentah (sebelum di-parse jadi object) di req.rawBody
    // -- dibutuhkan verifyGowaWebhookSignature.js buat hitung ulang HMAC
    // signature, yang HARUS dihitung dari bytes persis seperti yang
    // dikirim GOWA, bukan hasil JSON.stringify(req.body) yang bisa beda
    // urutan key/whitespace-nya.
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

// Webhook dari GOWA (server-to-server) -- SENGAJA dipasang SEBELUM
// apiKeyAuth di bawah, karena endpoint ini diautentikasi pakai HMAC
// signature (X-Hub-Signature-256), BUKAN header X-API-Key seperti
// endpoint dashboard lainnya.
app.use("/api", webhookRoutes);

// Rate limit umum buat semua endpoint /api (rate limit khusus yang lebih
// ketat untuk /api/send-message ada di messageRoutes.js).
app.use("/api", generalLimiter);

// Autentikasi API key (lihat middleware/apiKeyAuth.js -- otomatis
// nonaktif kalau BACKEND_API_KEY belum di-set di .env).
app.use("/api", apiKeyAuth);

app.use("/api", messageRoutes);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "csc-dashboard-backend" });
});

// Error handler terakhir -- jaga-jaga supaya error tak terduga (mis. dari
// body JSON yang rusak) tidak balik sebagai HTML/stack trace ke client.
app.use((err, _req, res, _next) => {
  console.error("[unhandled error]", err?.message ?? err);
  res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
});

// Fail-closed: server ini TIDAK akan start kalau BACKEND_API_KEY belum
// di-set, kecuali operator secara SADAR mengaktifkan mode dev tanpa
// autentikasi lewat ALLOW_UNAUTHENTICATED_DEV=true (khusus development
// lokal -- JANGAN dipakai di staging/production).
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

const PORT = process.env.PORT || 3001;

// v3.4: susun ulang antrian pengiriman dari baris 'antri' yang tersisa di
// DB (kalau backend ini sebelumnya sempat mati/restart di tengah antrian)
// SEBELUM server mulai nerima request baru.
initQueueFromDatabase()
  .catch((error) => {
    console.error("[server] Gagal memuat ulang antrian dari database:", error?.message ?? error);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server jalan di http://localhost:${PORT}`);
    });
  });
