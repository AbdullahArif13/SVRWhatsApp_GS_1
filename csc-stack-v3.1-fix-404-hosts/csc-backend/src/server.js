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
    // v3.10: WAJIB true supaya cookie sesi login (lihat express-session di
    // bawah) ikut terkirim di request cross-origin dari dashboard (origin
    // browser beda port dari backend). Aman dipasangkan sama origin
    // whitelist di atas (bukan wildcard "*") -- browser MENOLAK kombinasi
    // credentials:true + Access-Control-Allow-Origin:"*".
    credentials: true,
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

// v3.10: session login dashboard (Admin, username+password) -- BEDA dan
// TERPISAH dari apiKeyAuth di bawah (lihat middleware/requireLogin.js
// untuk penjelasan lengkap kenapa dua-duanya tetap dipasang). Session
// disimpan di PostgreSQL (tabel `session`, skema baku connect-pg-simple)
// supaya Admin TIDAK ke-logout tiap kali backend restart/redeploy --
// beda dengan store default express-session (in-memory) yang hilang
// tiap proses restart.
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET,
    name: "csc_session",
    resave: false,
    saveUninitialized: false,
    // Diperpanjang otomatis tiap ada request baru (bukan cuma dihitung
    // dari waktu login) -- Admin yang aktif tidak ke-logout paksa di
    // tengah kerja, tapi sesi yang beneran ditinggal tetap kedaluwarsa.
    rolling: true,
    cookie: {
      httpOnly: true,
      // TODO: ganti ke true begitu dashboard sudah diakses lewat HTTPS --
      // saat ini masih HTTP (LAN internal), cookie "secure" tidak akan
      // pernah tersimpan browser kalau diaktifkan sebelum ada HTTPS.
      secure: false,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 jam
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
// nonaktif kalau BACKEND_API_KEY belum di-set di .env). authRoutes
// (login/logout/me/sessions) SENGAJA tetap lewat gerbang ini juga --
// dashboard sudah selalu kirim X-API-Key di semua request (lihat
// services/api.js FrontEnd), jadi tidak perlu dikecualikan.
app.use("/api", apiKeyAuth);

app.use("/api", messageRoutes);
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", analyticsRoutes);

// v3.8: file foto yang diupload langsung (multipart) lewat POST
// /api/send-message (lihat middleware/uploadPhoto.js) di-serve statis dari
// sini -- inilah yang jadi "URL" yang diteruskan ke GOWA (GOWA cuma terima
// image_url, bukan file mentah). TIDAK pakai apiKeyAuth supaya GOWA (server-
// to-server, tanpa header X-API-Key) bisa langsung download filenya.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "csc-dashboard-backend" });
});

// Error handler terakhir -- jaga-jaga supaya error tak terduga (mis. dari
// body JSON yang rusak) tidak balik sebagai HTML/stack trace ke client.
app.use((err, _req, res, _next) => {
  // v3.8: error dari uploadPhoto.js (multer) -- MIME ditolak/file kelewat
  // besar -- kasih pesan 400 yang jelas, bukan "kesalahan server" generik.
  if (err instanceof multer.MulterError || /^Field 'foto' harus berupa/.test(err?.message ?? "")) {
    return res.status(400).json({ success: false, message: err.message });
  }
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

// v3.10: fail-closed sama seperti BACKEND_API_KEY di atas -- SESSION_SECRET
// dipakai express-session untuk menandatangani cookie sesi login Admin.
// Kalau kosong, express-session masih MAU jalan pakai secret kosong/default
// yang bisa ditebak -- itu sama saja dengan tidak ada proteksi sesi sama
// sekali, jadi server ini SENGAJA menolak start daripada diam-diam insecure.
if (!process.env.SESSION_SECRET) {
  console.error(
    "[FATAL] SESSION_SECRET belum di-set. Server TIDAK dijalankan supaya cookie sesi login Admin " +
      "tidak pernah ditandatangani pakai secret kosong/bisa ditebak.\n" +
      "  - Isi SESSION_SECRET di csc-backend/.env dengan string acak (mis. `openssl rand -base64 32`)."
  );
  process.exit(1);
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
