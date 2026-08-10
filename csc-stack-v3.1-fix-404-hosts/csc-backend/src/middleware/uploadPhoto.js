import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

/**
 * Dipakai POST /api/send-message versi "kirim file langsung" (multipart/
 * form-data) -- alternatif dari cara lama (JSON biasa, values.foto berisi
 * URL). Sistem pemanggil (mis. CCTV) yang TIDAK punya tempat hosting
 * gambar sendiri bisa langsung attach file JPG/PNG di field "foto",
 * backend ini yang simpan filenya lalu ubah jadi URL internal supaya bisa
 * diteruskan ke GOWA (GOWA cuma terima image_url, bukan file mentah dari
 * kita -- lihat services/waService.js:sendWhatsAppImage).
 *
 * Request YANG SUDAH ADA (Content-Type: application/json, values.foto
 * berisi URL) SAMA SEKALI TIDAK terpengaruh -- multer cuma aktif kalau
 * Content-Type-nya multipart/form-data, selain itu langsung next() tanpa
 * mengubah apa-apa (lihat handleSendMessage di messageController.js untuk
 * percabangan dua alur ini).
 */

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "photos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Sama seperti batas MIME yang dipakai GOWA sendiri untuk file upload
// langsung (src/validations/send_validation.go di source GOWA) -- cuma
// JPG/PNG, supaya konsisten dan tidak kirim format yang bakal ditolak GOWA.
const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TO_EXT[file.mimetype] ?? path.extname(file.originalname) ?? "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    cb(new Error("Field 'foto' harus berupa file JPG atau PNG."));
    return;
  }
  cb(null, true);
}

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB -- cukup longgar untuk snapshot CCTV terkompresi, tapi tetap ada batas anti-DoS.
    files: 1,
  },
});

/**
 * URL internal yang dipakai GOWA untuk download file yang baru diupload
 * lewat middleware ini. Default `http://backend:3001` -- nama service
 * Docker `backend` sudah pasti reachable dari container `whatsapp` (GOWA),
 * SAMA seperti WHATSAPP_WEBHOOK yang dipakai GOWA untuk lapor balik ke kita
 * (lihat docker-compose.yml). Bisa dioverride lewat env INTERNAL_BACKEND_URL
 * kalau suatu saat setup-nya bukan lagi docker-compose bawaan ini.
 */
export function buildUploadedPhotoUrl(filename) {
  const base = (process.env.INTERNAL_BACKEND_URL || "http://backend:3001").replace(/\/+$/, "");
  return `${base}/uploads/photos/${filename}`;
}
