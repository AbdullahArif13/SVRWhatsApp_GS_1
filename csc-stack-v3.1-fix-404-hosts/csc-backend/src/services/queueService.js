import { sendWhatsAppMessage, sendWhatsAppImage, extractProviderMessageId, normalizePhoneDigits } from "./waService.js";
import {
  addQueuedMessageLog,
  updateMessageLogResult,
  listQueuedMessageLogIds,
  findMessageLogById,
} from "../data/messageLogs.js";

/**
 * ANTRIAN pengiriman WhatsApp -- pola "token bucket".
 *
 * Masalah yang diselesaikan: sistem eksternal bisa nge-hit
 * POST /api/send-message ribuan kali sekaligus (bursty), tapi WhatsApp
 * (lewat GOWA) tidak boleh dibanjiri sekencang itu -- risiko nomor WA
 * kena banned. Solusinya BUKAN nolak kelebihannya, tapi TAMPUNG semua
 * request yang valid, lalu keluarin ke GOWA sesuai rate limit yang diatur.
 *
 * v3.6 -- PENTING, ini yang beda dari versi sebelumnya: SELAMA masih di
 * bawah rate limit, pesan dikirim LANGSUNG SAAT ITU JUGA (status di DB
 * cuma mampir sebentar banget di 'antri' sebelum langsung jadi
 * 'terkirim'/'gagal') -- BUKAN nunggu giliran "tick" tetap tiap
 * INTERVAL_MS kayak sebelumnya (itu bug: dulu 1 pesan pun tetap nunggu
 * sampai 2 detik walau jatah rate limit-nya kosong melompong). Antrian
 * FIFO (nunggu beneran) HANYA dipakai kalau jatah kirim per menit-nya
 * (RATE_LIMIT_PER_MINUTE) sedang benar-benar habis.
 *
 * Analoginya: `tokens` itu kayak jatah tiket yang bisa dipakai kapan
 * saja begitu masih ada -- diisi ulang 1 tiket tiap INTERVAL_MS
 * (60 detik / RATE_LIMIT_PER_MINUTE), maksimal terisi penuh sampai
 * RATE_LIMIT_PER_MINUTE. Begitu tiketnya habis, pesan baru BENERAN
 * masuk antrian (array `queue`) dan baru diproses begitu ada tiket
 * yang keisi ulang lagi.
 *
 * Kenapa datanya di DB (bukan cuma array di RAM)? Supaya kalau backend
 * restart di tengah-tengah, antrian yang belum sempat diproses TIDAK
 * hilang -- initQueueFromDatabase() (dipanggil dari server.js pas start)
 * baca ulang baris yang masih 'antri' dan nyusun ulang `queue` di RAM.
 */

// Berapa pesan/menit yang diizinkan keluar ke GOWA -- inti dari
// pembatasan yang diminta ("gak lebih dari 30 send message dalam 1
// menit"). Bisa diubah lewat .env tanpa ubah kode.
const RATE_LIMIT_PER_MINUTE = Math.max(1, Number(process.env.QUEUE_RATE_LIMIT_PER_MINUTE) || 30);
const INTERVAL_MS = Math.ceil(30_000 / RATE_LIMIT_PER_MINUTE);

// Batas atas ukuran antrian FIFO (bukan throttle normal, cuma jaga-jaga
// anti-DoS supaya kalau ada yang sengaja ngirim jutaan request
// sekaligus, memori server tidak ikut jebol). "Ribuan" dari kasus
// normal jauh di bawah ini.
const MAX_QUEUE_LENGTH = Math.max(1, Number(process.env.QUEUE_MAX_LENGTH) || 10_000);

/**
 * v3.9 -- pengerasan pola kirim supaya tidak gampang dibedakan dari
 * "bot" oleh sistem deteksi WhatsApp (rate limiter di atas SAJA tidak
 * cukup, karena jarak antar pesan jadi terlalu presisi/mekanis):
 *
 *   SEND_JITTER_MIN_MS/MAX_MS      -- delay acak tambahan (di luar rate
 *     limit) sebelum TIAP pengiriman, supaya jarak antar pesan tidak
 *     pernah identik persis kayak robot.
 *   SEND_COOLDOWN_PER_NUMBER_MS    -- jeda minimal ke NOMOR YANG SAMA.
 *     Kalau ada bug retry di sistem eksternal yang nembak /send-message
 *     berkali-kali ke nomor sama dalam waktu dekat, di sini pesan
 *     berikutnya ke nomor itu DITUNDA (bukan digagalkan) sampai jeda
 *     terpenuhi -- mencegah pola "spam ke satu nomor" yang sering jadi
 *     pemicu laporan/deteksi dari sisi penerima. TIDAK berlaku untuk
 *     balasan otomatis Approve/Reject (sendAutoReply di
 *     webhookController.js) -- itu sengaja lewat jalur langsung, bukan
 *     antrian ini, karena itu respons wajar dalam percakapan aktif.
 *   CIRCUIT_FAILURE_THRESHOLD/COOLDOWN_MS -- "circuit breaker": kalau
 *     pengiriman gagal beruntun sejumlah ini (indikasi GOWA/WhatsApp lagi
 *     bermasalah atau nomor mulai kena restrict sementara), SEMUA
 *     pengiriman baru dijeda otomatis selama CIRCUIT_COOLDOWN_MS -- supaya
 *     sistem tidak "ngegas terus" di rate penuh pas providernya lagi
 *     limitasi kita. Pesan yang masih di antrian TIDAK hilang, otomatis
 *     lanjut lagi begitu jeda berakhir.
 */
const JITTER_MIN_MS = Math.max(0, Number(process.env.SEND_JITTER_MIN_MS) || 300);
const JITTER_MAX_MS = Math.max(JITTER_MIN_MS, Number(process.env.SEND_JITTER_MAX_MS) || 1500);
const COOLDOWN_PER_NUMBER_MS = Math.max(0, Number(process.env.SEND_COOLDOWN_PER_NUMBER_MS) || 60_000);
const CIRCUIT_FAILURE_THRESHOLD = Math.max(1, Number(process.env.CIRCUIT_FAILURE_THRESHOLD) || 5);
const CIRCUIT_COOLDOWN_MS = Math.max(1_000, Number(process.env.CIRCUIT_COOLDOWN_MS) || 3 * 60_000);

/** Jatah kirim yang tersisa SAAT INI -- mulai penuh, supaya burst pertama
 * (mis. baru habis restart) langsung bisa lewat semua sampai batas
 * RATE_LIMIT_PER_MINUTE tanpa nunggu apa-apa. */
let tokens = RATE_LIMIT_PER_MINUTE;

/** @type {number[]} id message_logs yang BENERAN nunggu giliran (jatah lagi habis), FIFO. */
let queue = [];
let refillTimer = null;

// Circuit breaker: state murni in-memory (reset tiap restart, itu wajar --
// restart otomatis bikin jeda pengiriman juga).
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

/** Kapan terakhir kali BERHASIL kirim ke nomor ini (key = digit ternormalisasi). */
const lastSentAtByNumber = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitterMs() {
  return JITTER_MIN_MS + Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1));
}

function isCircuitOpen() {
  return Date.now() < circuitOpenUntil;
}

/** Dipanggil setiap pengiriman berhasil -- circuit breaker pulih begitu ada 1 sukses. */
function recordSendSuccess() {
  consecutiveFailures = 0;
}

/** Dipanggil setiap pengiriman gagal -- trip circuit breaker kalau sudah kelewat batas. */
function recordSendFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && !isCircuitOpen()) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    console.error(
      `[ALERT][queueService] Circuit breaker AKTIF -- ${consecutiveFailures} pengiriman gagal berturut-turut. ` +
        `Pengiriman baru DIJEDA ${Math.round(CIRCUIT_COOLDOWN_MS / 1000)} detik (kemungkinan GOWA/sesi WhatsApp ` +
        `sedang bermasalah). Pesan yang masih di antrian TIDAK hilang, otomatis lanjut begitu jeda berakhir.`
    );
  }
}

/** Status circuit breaker saat ini -- dipakai messageController.js untuk kasih tahu pemanggil kalau pengiriman lagi dijeda. */
export function getCircuitBreakerStatus() {
  const open = isCircuitOpen();
  return { open, resumesAt: open ? new Date(circuitOpenUntil).toISOString() : null };
}

export function getQueueLength() {
  return queue.length;
}

/** Posisi id ini di antrian (1 = berikutnya diproses), null kalau sudah tidak di antrian lagi. */
export function getQueuePosition(id) {
  const index = queue.indexOf(id);
  return index === -1 ? null : index + 1;
}

/** Perkiraan berapa detik lagi sampai giliran posisi ke-N diproses. */
export function estimateWaitSeconds(position) {
  if (!position || position < 1) return 0;
  return Math.round((position * INTERVAL_MS) / 1000);
}

/**
 * Masukkan satu pesan. Dipanggil messageController.js SETELAH
 * template_wa & values selesai divalidasi dan final_message sudah
 * dirender -- fungsi ini sendiri tidak melakukan validasi apa pun lagi.
 *
 * Kalau jatah (`tokens`) masih ada -> diproses SEKARANG JUGA (tidak
 * nunggu apa-apa), balikin { immediate: true }. Kalau jatah lagi habis
 * -> BARU masuk antrian FIFO beneran, balikin { immediate: false,
 * position, estimatedWaitSeconds }.
 *
 * Melempar Error({ code: "QUEUE_FULL" }) kalau antrian FIFO lagi penuh
 * (lihat MAX_QUEUE_LENGTH) -- controller yang menentukan status HTTP-nya.
 */
export async function enqueueMessage({ template_wa, no_wa, nama_wa, values, finalMessage, requireReply }) {
  if (queue.length >= MAX_QUEUE_LENGTH) {
    const error = new Error(
      `Antrian sedang penuh (maksimal ${MAX_QUEUE_LENGTH} pesan menunggu). Coba kirim lagi beberapa saat lagi.`
    );
    error.code = "QUEUE_FULL";
    throw error;
  }

  const row = await addQueuedMessageLog({
    template_wa,
    no_wa,
    nama_wa,
    values,
    final_message: finalMessage,
    requireReply,
  });

  ensureRefillTimerRunning();

  if (tokens > 0 && !isCircuitOpen()) {
    // Masih ada jatah DAN circuit breaker belum aktif -- KIRIM SEKARANG,
    // tidak masuk antrian sama sekali.
    tokens -= 1;
    processOne(row.id).catch((error) => {
      console.error(`[queueService] Error tak terduga memproses id=${row.id}:`, error?.message ?? error);
    });
    return { row, position: 0, estimatedWaitSeconds: 0, immediate: true };
  }

  // Jatah lagi habis -- BARU beneran masuk antrian, nunggu jatah keisi lagi.
  queue.push(row.id);
  const position = queue.length;
  return { row, position, estimatedWaitSeconds: estimateWaitSeconds(position), immediate: false };
}

function ensureRefillTimerRunning() {
  if (refillTimer) return; // sudah jalan, gak perlu interval baru
  refillTimer = setInterval(() => {
    tokens = Math.min(RATE_LIMIT_PER_MINUTE, tokens + 1);
    drainQueue(); // ada jatah baru keisi -- kalau ada backlog nunggu, proses sekarang
  }, INTERVAL_MS);
}

/** Selama masih ada jatah, masih ada backlog, DAN circuit breaker belum aktif, proses terus. */
function drainQueue() {
  while (tokens > 0 && queue.length > 0 && !isCircuitOpen()) {
    tokens -= 1;
    const id = queue.shift();
    processOne(id).catch((error) => {
      console.error(`[queueService] Error tak terduga memproses id=${id}:`, error?.message ?? error);
    });
  }
}

/** Cari value suatu key di object `values` tanpa peduli besar/kecil huruf key-nya. */
function getValueCaseInsensitive(values, key) {
  if (!values || typeof values !== "object") return undefined;
  const entry = Object.entries(values).find(([k]) => k.toLowerCase() === key);
  return entry ? entry[1] : undefined;
}

async function processOne(id) {
  const row = await findMessageLogById(id);
  if (!row) {
    console.warn(`[queueService] id=${id} seharusnya diproses tapi baris DB-nya tidak ketemu, dilewati.`);
    return;
  }

  // Jitter (jarak antar pesan tidak pernah identik persis) + cooldown per
  // nomor (jeda minimal ke nomor yang sama) -- lihat komentar di bagian
  // konfigurasi atas file ini. Ini di LUAR token bucket, jadi tidak
  // mengganggu penghitungan rate limit yang sudah ada.
  const normalizedNo = normalizePhoneDigits(row.no_wa);
  const lastSentAt = lastSentAtByNumber.get(normalizedNo);
  const cooldownRemaining = lastSentAt
    ? Math.max(0, COOLDOWN_PER_NUMBER_MS - (Date.now() - lastSentAt))
    : 0;
  const extraDelay = cooldownRemaining + randomJitterMs();
  if (extraDelay > 0) {
    await sleep(extraDelay);
  }

  // Circuit breaker bisa saja baru trip SELAMA delay di atas (mis. kiriman
  // lain yang berjalan bersamaan baru gagal) -- cek ulang sebelum benar-benar
  // kirim. Kalau ternyata sudah aktif, taruh lagi id ini di depan antrian
  // (BUKAN digagalkan) supaya otomatis dicoba lagi begitu jeda berakhir.
  if (isCircuitOpen()) {
    queue.unshift(id);
    return;
  }

  try {
    const result = await sendWhatsAppMessage(row.no_wa, row.final_message);
    recordSendSuccess();
    lastSentAtByNumber.set(normalizedNo, Date.now());
    const providerMessageId = extractProviderMessageId(result);

    if (row.require_reply && !providerMessageId) {
      // Template ini butuh balasan Approve/Reject, tapi provider (GOWA)
      // tidak mengembalikan message_id (mis. lagi mode simulasi karena
      // GOWA_BASE_URL belum diisi) -- tanpa message_id, balasan user nanti
      // TIDAK BISA dicocokkan ke kiriman ini sama sekali. Beri tahu di log
      // server supaya kelihatan pas setup, tapi pengiriman tetap dianggap
      // berhasil (pesannya memang sudah "terkirim"/tersimulasi).
      console.warn(
        `[queueService] id=${id}: template '${row.template_wa}' butuh balasan Approve/Reject, tapi provider tidak mengembalikan message_id -- balasan user nanti tidak akan bisa dicocokkan.`
      );
    }

    // Fitur "kirim bukti foto" (mis. notifikasi CCTV AI Vision/SHE): kalau
    // `values.foto` (URL gambar) diisi di POST /api/send-message, kirim
    // SEBAGAI PESAN KEDUA setelah teks di atas berhasil -- urutan tampilnya
    // di WA jadi: 1) teks detail (template body), 2) foto + caption dari
    // `values.keterangan` (kalau ada). Validasi format URL sudah dilakukan
    // di messageController.js sebelum masuk sini, jadi di sini tinggal pakai.
    //
    // Kalau kirim foto gagal, JANGAN gagalkan keseluruhan status --
    // pesan teksnya sendiri sudah beneran terkirim -- cukup catat sebagai
    // catatan di error_message supaya kelihatan di Riwayat Pengiriman.
    let imageWarning = null;
    const fotoUrl = getValueCaseInsensitive(row.values, "foto");
    if (fotoUrl && String(fotoUrl).trim() !== "") {
      try {
        const caption = getValueCaseInsensitive(row.values, "keterangan");
        await sendWhatsAppImage(row.no_wa, fotoUrl, caption != null ? String(caption) : "");
      } catch (imageError) {
        console.error(`[queueService] id=${id}: teks terkirim, tapi gagal kirim foto:`, imageError?.message ?? imageError);
        imageWarning = `Teks berhasil terkirim, tapi gagal mengirim foto: ${imageError?.message ?? "unknown error"}`;
      }
    }

    await updateMessageLogResult(id, { status: "terkirim", providerMessageId, errorMessage: imageWarning });
  } catch (error) {
    recordSendFailure();
    console.error(`[queueService] Gagal kirim pesan id=${id}:`, error?.message ?? error);
    try {
      await updateMessageLogResult(id, {
        status: "gagal",
        errorMessage: error?.message ?? "Gagal mengirim pesan ke provider WhatsApp.",
      });
    } catch (dbError) {
      console.error(`[queueService] Gagal update status 'gagal' id=${id} ke DB:`, dbError?.message ?? dbError);
    }
  }
}

/**
 * Dipanggil SEKALI dari server.js pas backend baru start. Menyusun ulang
 * antrian di memori dari baris-baris yang masih berstatus 'antri' di DB
 * (sisa sebelum backend ini terakhir kali mati/restart), supaya tidak
 * hilang begitu saja. Jatah (`tokens`) mulai penuh lagi pas restart --
 * wajar, karena restart otomatis bikin jeda pengiriman (tidak melanggar
 * rate rata-rata), jadi backlog lama boleh langsung diproses sesuai jatah
 * yang tersedia (lewat drainQueue()), bukan dites nunggu dari nol lagi.
 */
export async function initQueueFromDatabase() {
  const pendingIds = await listQueuedMessageLogIds();
  queue = [...pendingIds, ...queue];
  if (pendingIds.length > 0) {
    console.log(
      `[queueService] Memuat ulang ${pendingIds.length} pesan yang masih 'antri' dari sebelum restart terakhir.`
    );
  }
  ensureRefillTimerRunning();
  drainQueue();
}
