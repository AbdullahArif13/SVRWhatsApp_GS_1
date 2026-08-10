import axios from "axios";

/**
 * GOWA (go-whatsapp-web-multidevice) integration.
 * Repo: https://github.com/aldinokemal/go-whatsapp-web-multidevice
 *
 * File ini SATU-SATUNYA yang diubah untuk pindah provider WA.
 * Signature sendWhatsAppMessage(noWa, message) dipertahankan sama persis
 * seperti sebelumnya, jadi messageController.js, messageRoutes.js, dan
 * struktur JSON /api/send-message (template_wa, no_wa, values) SAMA
 * SEKALI TIDAK berubah.
 */

/**
 * Rapikan nomor jadi digit polos internasional (contoh: "089189182" jadi
 * "6289189182"). Dipakai bareng oleh toWhatsAppJid() di bawah DAN oleh
 * data/contacts.js, supaya kunci dedup kontak (no_wa) sama persis dengan
 * nomor yang benar-benar dipakai buat kirim WA -- "089..." dan "6289..."
 * harus dianggap kontak yang sama, bukan dobel.
 *
 * Kalau nomor sudah berformat JID (mengandung "@"), dikembalikan apa
 * adanya (dipotong sebelum "@") supaya tetap konsisten dipakai sebagai key.
 */
export function normalizePhoneDigits(noWa) {
  const raw = String(noWa ?? "").trim();
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;

  let digits = beforeAt.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }

  return digits;
}

/**
 * Rapikan nomor tujuan supaya sesuai format yang dipakai GOWA/whatsmeow:
 * "<nomor_internasional>@s.whatsapp.net" (contoh: 6281234567890@s.whatsapp.net).
 *
 * - Buang semua karakter selain digit (spasi, strip, kurung, +).
 * - Kalau diawali "0" (format lokal Indonesia, mis. 089189182), ganti
 *   jadi awalan "62".
 * - Kalau nomor yang dikirim frontend sudah dalam format JID lengkap
 *   (mengandung "@"), pakai apa adanya tanpa diutak-atik.
 */
function toWhatsAppJid(noWa) {
  const raw = String(noWa ?? "").trim();

  if (raw.includes("@")) {
    return raw; // sudah berupa JID (mis. "6281234567890@s.whatsapp.net" atau "...@g.us" untuk grup)
  }

  return `${normalizePhoneDigits(raw)}@s.whatsapp.net`;
}

/**
 * Mengirim pesan WA lewat GOWA.
 *
 * Endpoint GOWA yang dipakai: POST {GOWA_BASE_URL}/send/message
 * Body ke GOWA: { "phone": "<jid_tujuan>", "message": "<isi_pesan>" }
 *
 * Env yang dibutuhkan (lihat .env.example):
 *   GOWA_BASE_URL         -> contoh: http://localhost:3000
 *   GOWA_BASIC_AUTH_USER  -> opsional, kalau GOWA dijalankan dengan --basic-auth
 *   GOWA_BASIC_AUTH_PASS  -> opsional, pasangan dari user di atas
 *   GOWA_DEVICE_ID        -> opsional, isi kalau GOWA kamu setup multi-device
 *                             (dikirim sebagai header X-Device-Id). Kalau GOWA
 *                             cuma punya 1 device yang login, boleh dikosongkan.
 */
export async function sendWhatsAppMessage(noWa, message) {
  const baseUrl = process.env.GOWA_BASE_URL;
  const username = process.env.GOWA_BASIC_AUTH_USER;
  const password = process.env.GOWA_BASIC_AUTH_PASS;
  const deviceId = process.env.GOWA_DEVICE_ID;

  if (!baseUrl) {
    // Belum ada GOWA_BASE_URL yang dikonfigurasi -> mode simulasi,
    // supaya endpoint tetap bisa dites end-to-end tanpa kirim WA beneran.
    console.log("[waService] Simulasi kirim WA (GOWA_BASE_URL belum diisi):");
    console.log({ to: noWa, message });
    return { simulated: true, to: noWa, message };
  }

  const phone = toWhatsAppJid(noWa);

  const headers = { "Content-Type": "application/json" };
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  const axiosConfig = { headers };
  if (username && password) {
    axiosConfig.auth = { username, password };
  }

  const response = await axios.post(
    `${baseUrl.replace(/\/+$/, "")}/send/message`,
    { phone, message },
    axiosConfig
  );

  return response.data;
}

/**
 * Mengirim GAMBAR (dengan caption opsional) lewat GOWA.
 *
 * Endpoint GOWA yang dipakai: POST {GOWA_BASE_URL}/send/image
 * Body ke GOWA: { "phone": "<jid_tujuan>", "image_url": "<url_gambar>", "caption": "<teks>" }
 * (struct `ImageRequest` GOWA menerima field ini lewat JSON maupun form --
 * lihat src/domains/send/image.go & docs/openapi.yaml di source GOWA,
 * TIDAK ada satu baris pun kode GOWA yang diubah untuk fitur ini).
 *
 * Dipakai untuk fitur "kirim bukti foto" (mis. notifikasi CCTV AI Vision/SHE)
 * -- kalau `values.foto` (berisi URL gambar) dikirim ke POST /api/send-message,
 * gambar ini dikirim sebagai PESAN KEDUA setelah pesan teks template utama
 * (lihat queueService.js -> processOne()), supaya urutannya di WA persis:
 * 1) pesan teks detail (dari template body), lalu 2) pesan foto + caption
 * singkat (diisi dari `values.keterangan` kalau ada).
 *
 * PENTING: GOWA cuma menerima gambar lewat upload file (multipart) ATAU
 * `image_url` (link publik yang BISA DIAKSES LANGSUNG oleh server GOWA) --
 * BUKAN base64. Jadi `imageUrl` di sini wajib berupa link http(s) yang
 * sudah bisa diakses (mis. hasil upload snapshot CCTV ke storage/CDN
 * internal), bukan data gambar mentah.
 */
export async function sendWhatsAppImage(noWa, imageUrl, caption = "") {
  const baseUrl = process.env.GOWA_BASE_URL;
  const username = process.env.GOWA_BASIC_AUTH_USER;
  const password = process.env.GOWA_BASIC_AUTH_PASS;
  const deviceId = process.env.GOWA_DEVICE_ID;

  if (!baseUrl) {
    // Sama seperti sendWhatsAppMessage(): belum ada GOWA_BASE_URL -> mode
    // simulasi, supaya alur "kirim foto" tetap bisa dites end-to-end tanpa
    // kirim WA beneran.
    console.log("[waService] Simulasi kirim FOTO WA (GOWA_BASE_URL belum diisi):");
    console.log({ to: noWa, imageUrl, caption });
    return { simulated: true, to: noWa, imageUrl, caption };
  }

  const phone = toWhatsAppJid(noWa);

  const headers = { "Content-Type": "application/json" };
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  const axiosConfig = { headers };
  if (username && password) {
    axiosConfig.auth = { username, password };
  }

  const response = await axios.post(
    `${baseUrl.replace(/\/+$/, "")}/send/image`,
    { phone, image_url: imageUrl, caption },
    axiosConfig
  );

  return response.data;
}

/**
 * Ambil ID pesan dari respons GOWA (dipakai untuk fitur Approve/Reject --
 * ID ini yang nanti dicocokkan dengan `replied_to_id` pas user membalas,
 * lihat webhookController.js).
 *
 * Respons sukses GOWA berbentuk { code, message, results: { message_id, status } },
 * sedangkan mode simulasi (GOWA_BASE_URL belum diisi, lihat di atas) tidak
 * punya message_id sama sekali -- fungsi ini mengembalikan null untuk kasus
 * itu, supaya jelas fitur Approve/Reject tidak bisa jalan di mode simulasi.
 */
export function extractProviderMessageId(providerResult) {
  return providerResult?.results?.message_id ?? null;
}
