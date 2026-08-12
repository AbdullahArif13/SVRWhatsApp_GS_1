import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "photos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
    fileSize: 8 * 1024 * 1024, 
    files: 1,
  },
});

export function buildUploadedPhotoUrl(filename) {
  const base = (process.env.INTERNAL_BACKEND_URL || "http://backend:3001").replace(/\/+$/, "");
  return `${base}/uploads/photos/${filename}`;
}
