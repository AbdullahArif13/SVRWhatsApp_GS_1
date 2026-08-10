// Base URL backend Express (lihat proyek `csc-dashboard-backend`).
// Bisa dioverride lewat file .env -> VITE_API_BASE_URL=http://localhost:3001/api
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// Dikirim sebagai header X-API-Key ke backend (lihat catatan keamanan
// di .env.example). Kosong kalau backend belum mengaktifkan proteksi ini.
export const API_KEY = import.meta.env.VITE_API_KEY || "";
