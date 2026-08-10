import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// v3.8 (fix 404 saat akses lewat domain kantor): Vite 5 secara default
// menolak request yang header Host-nya bukan localhost/127.0.0.1/IP LAN
// biasa (proteksi bawaan terhadap DNS rebinding attack). Kalau dashboard
// dibuka lewat domain (mis. https://csc-center.gs.astra.co.id), domain
// itu HARUS didaftarkan di sini lewat VITE_ALLOWED_HOST di .env, kalau
// tidak Vite balikin 403/blank, BUKAN error React -- gejalanya kadang
// malah kelihatan kayak masalah lain di browser.
//
// Isi VITE_ALLOWED_HOST cuma HOSTNAME-nya saja (TANPA http/https, TANPA
// port), boleh lebih dari satu dipisah koma, contoh:
//   VITE_ALLOWED_HOST=csc-center.gs.astra.co.id,10.19.101.126
const allowedHosts = (process.env.VITE_ALLOWED_HOST || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // wajib biar bisa diakses dari luar container Docker
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
  },
});
