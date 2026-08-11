import { sendWhatsAppMessage, sendWhatsAppImage, extractProviderMessageId, normalizePhoneDigits } from "./waService.js";
import {
  addQueuedMessageLog,
  updateMessageLogResult,
  listQueuedMessageLogQueueEntries,
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
const INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_PER_MINUTE);

// Batas atas ukuran antrian FIFO (bukan throttle normal, cuma jaga-jaga
// anti-DoS supaya kalau ada yang sengaja ngirim jutaan request
// sekaligus, memori server tidak ikut jebol). "Ribuan" dari kasus
// normal jauh di bawah ini.
const MAX_QUEUE_LENGTH = Math.max(1, Number(process.env.QUEUE_MAX_LENGTH) || 10_000);

/**
 * v3.11 -- rate limit TAMBAHAN per TEMPLATE, di ATAS (bukan menggantikan)
 * RATE_LIMIT_PER_MINUTE (30/menit) di atas.
 *
 * Masalah yang diselesaikan: RATE_LIMIT_PER_MINUTE cuma membatasi TOTAL
 * pesan keluar per menit, tidak peduli itu tersebar di banyak template
 * atau semuanya numpuk di SATU template. Kejadian broadcast dari API Key
 * eksternal "KehidupanMalam" nunjukkin lubangnya: satu template bisa
 * "menghabiskan" jatah 30/menit itu sendirian dalam hitungan detik kalau
 * memang di bawah limit total, dan pola kirim yang super rapat ke SATU
 * template kayak gitu yang justru rawan kena deteksi spam/banned di sisi
 * WhatsApp -- bukan cuma soal total volume.
 *
 * Solusinya DUA lapis rate limit baru, keduanya token bucket juga (pola
 * sama seperti RATE_LIMIT_PER_MINUTE), dan keduanya SAMA SEKALI TIDAK
 * mengubah/mengurangi jatah `tokens` (30/menit) yang sudah ada -- cuma
 * jadi SYARAT TAMBAHAN sebelum sebuah pesan boleh benar-benar diproses:
 *
 *   TEMPLATE_RATE_LIMIT_PER_MINUTE (default 5)
 *     -- jatah keluar per MENIT untuk MASING-MASING template, dihitung
 *     terpisah per nama template. Bucket-nya dibuat OTOMATIS begitu
 *     template itu pertama kali dipakai kirim (lihat ensureTemplateBucket)
 *     -- jadi template baru yang ditambahkan lewat dashboard LANGSUNG
 *     dapat jatah 5/menit sendiri tanpa perlu ubah kode/konfigurasi apa
 *     pun.
 *
 *   TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE (default 15)
 *     -- jatah keluar per menit yang DIBAGI BERSAMA oleh SEMUA template
 *     (satu bucket tunggal, bukan per-nama). Ini jaring pengaman kalau
 *     banyak template BERBEDA dipakai bersamaan -- masing-masing di bawah
 *     jatah 5/menit-nya sendiri, tapi totalnya tetap bisa meledak kalau
 *     tidak dibatasi lagi di sini. 15 sengaja diset di BAWAH 30 (jatah
 *     total pengiriman) supaya selalu ada sisa jatah 30/menit itu buat
 *     pesan-pesan NON-template-flood (spt balasan/kiriman normal lain)
 *     -- lihat juga catatan "tidak mengenai queue 30" di bawah.
 *
 * Sebuah pesan baru BENAR-BENAR dikirim kalau SEMUA syarat token
 * terpenuhi sekaligus: tokens (30/menit) > 0, jatah template-nya sendiri
 * (5/menit) > 0, DAN jatah global-template (15/menit) > 0. Kalau salah
 * satu belum terpenuhi, pesan itu TETAP di antrian `queue` (bukan
 * ditolak) menunggu jatah yang kurang itu terisi ulang -- dan SELAMA
 * menunggu itu, `tokens` (30/menit) TIDAK ikut berkurang/kepakai, jadi
 * pesan dari template lain yang jatahnya masih ada tetap bisa
 * "menyalip"/diproses duluan (lihat drainQueue) -- satu template yang lagi
 * kena limitnya sendiri tidak bikin antrian template LAIN ikut macet.
 */
const TEMPLATE_RATE_LIMIT_PER_MINUTE = Math.max(1, Number(process.env.TEMPLATE_RATE_LIMIT_PER_MINUTE) || 5);
const TEMPLATE_INTERVAL_MS = Math.ceil(60_000 / TEMPLATE_RATE_LIMIT_PER_MINUTE);

const TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE = Math.max(
  1,
  Number(process.env.TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE) || 15
);
const TEMPLATE_GLOBAL_INTERVAL_MS = Math.ceil(60_000 / TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE);

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

/**
 * @type {{ id: number, template_wa: string }[]} item message_logs yang
 * BENERAN nunggu giliran (jatah salah satu bucket lagi habis), FIFO
 * berdasarkan urutan masuk. Ikut menyimpan `template_wa` (bukan cuma id)
 * supaya drainQueue() bisa cek jatah TEMPLATE-nya tanpa query DB dulu.
 */
let queue = [];
let refillTimer = null;

/** Jatah kirim tersisa SAAT INI per nama template (key = nama template),
 * mulai penuh (TEMPLATE_RATE_LIMIT_PER_MINUTE) begitu template itu
 * pertama kali kepakai. */
const templateTokens = new Map();
/** setInterval id per nama template (satu refill timer sendiri-sendiri per template). */
const templateRefillTimers = new Map();

/** Jatah kirim tersisa SAAT INI yang dibagi bersama SEMUA template. */
let templateGlobalTokens = TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE;
let templateGlobalRefillTimer = null;

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

/**
 * Pastikan bucket + refill timer untuk SATU nama template sudah ada.
 * Dipanggil lazy (bukan didaftarkan manual di kode) tiap kali template itu
 * dipakai kirim, supaya template BARU yang ditambahkan lewat dashboard
 * otomatis dapat jatah 5/menit sendiri tanpa perlu sentuh kode ini lagi.
 */
function ensureTemplateBucket(templateName) {
  if (!templateTokens.has(templateName)) {
    templateTokens.set(templateName, TEMPLATE_RATE_LIMIT_PER_MINUTE);
  }
  if (!templateRefillTimers.has(templateName)) {
    const timer = setInterval(() => {
      const current = templateTokens.get(templateName) ?? 0;
      templateTokens.set(templateName, Math.min(TEMPLATE_RATE_LIMIT_PER_MINUTE, current + 1));
      drainQueue(); // jatah template ini keisi lagi -- coba proses backlog yang nunggu jatah ini
    }, TEMPLATE_INTERVAL_MS);
    // unref supaya timer ini tidak mencegah proses Node keluar (mis. pas testing/shutdown)
    timer.unref?.();
    templateRefillTimers.set(templateName, timer);
  }
}

function ensureTemplateGlobalRefillTimerRunning() {
  if (templateGlobalRefillTimer) return;
  templateGlobalRefillTimer = setInterval(() => {
    templateGlobalTokens = Math.min(TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE, templateGlobalTokens + 1);
    drainQueue(); // jatah global-template keisi lagi -- coba proses backlog
  }, TEMPLATE_GLOBAL_INTERVAL_MS);
  templateGlobalRefillTimer.unref?.();
}

/** True kalau template ini MASIH punya jatah (baik jatah sendiri 5/menit MAUPUN jatah global-template 15/menit). */
function hasTemplateQuota(templateName) {
  ensureTemplateBucket(templateName);
  ensureTemplateGlobalRefillTimerRunning();
  return (templateTokens.get(templateName) ?? 0) > 0 && templateGlobalTokens > 0;
}

/** Pakai 1 jatah dari KEDUA bucket template (punya sendiri + global-template) sekaligus. */
function consumeTemplateQuota(templateName) {
  templateTokens.set(templateName, (templateTokens.get(templateName) ?? 0) - 1);
  templateGlobalTokens -= 1;
}

export function getQueueLength() {
  return queue.length;
}

/** Posisi id ini di antrian (1 = berikutnya diproses), null kalau sudah tidak di antrian lagi. */
export function getQueuePosition(id) {
  const index = queue.findIndex((item) => item.id === id);
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

  // v3.11: sekarang ada TIGA syarat yang harus SEMUA terpenuhi biar boleh
  // kirim sekarang juga -- jatah total (30/menit) MAUPUN jatah template
  // ini sendiri (5/menit) MAUPUN jatah global-template (15/menit), lihat
  // komentar TEMPLATE_RATE_LIMIT_PER_MINUTE di atas file ini.
  if (tokens > 0 && !isCircuitOpen() && hasTemplateQuota(template_wa)) {
    // Semua jatah masih ada DAN circuit breaker belum aktif -- KIRIM
    // SEKARANG, tidak masuk antrian sama sekali.
    tokens -= 1;
    consumeTemplateQuota(template_wa);
    processOne(row.id).catch((error) => {
      console.error(`[queueService] Error tak terduga memproses id=${row.id}:`, error?.message ?? error);
    });
    return { row, position: 0, estimatedWaitSeconds: 0, immediate: true };
  }

  // Salah satu jatah lagi habis (bisa jatah total, jatah template ini
  // sendiri, atau jatah global-template) -- BARU beneran masuk antrian,
  // nunggu jatah yang kurang itu keisi lagi.
  queue.push({ id: row.id, template_wa });
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

/**
 * Selama masih ada jatah TOTAL (`tokens`), masih ada backlog, DAN circuit
 * breaker belum aktif, proses terus.
 *
 * v3.11: TIDAK LAGI selalu ambil item paling depan (`queue.shift()`)
 * begitu saja -- sekarang di-SCAN dari depan, item pertama yang jatah
 * TEMPLATE-nya (5/menit sendiri + 15/menit global-template) masih ada
 * itu yang diproses & dikeluarkan dari antrian, walau posisinya bukan
 * paling depan. Ini supaya SATU template yang lagi kena limitnya sendiri
 * (mis. broadcast dari satu API Key eksternal ke satu template) TIDAK
 * bikin pesan-pesan template LAIN yang masuk belakangan ikut ketahan --
 * `tokens` (30/menit) sama sekali tidak berkurang selama scan ini kalau
 * memang belum ada item yang lolos syarat template-nya.
 */
function drainQueue() {
  if (isCircuitOpen()) return;
  let i = 0;
  while (tokens > 0 && i < queue.length) {
    const item = queue[i];
    if (hasTemplateQuota(item.template_wa)) {
      queue.splice(i, 1);
      tokens -= 1;
      consumeTemplateQuota(item.template_wa);
      processOne(item.id).catch((error) => {
        console.error(`[queueService] Error tak terduga memproses id=${item.id}:`, error?.message ?? error);
      });
      // Jangan increment i -- item di posisi i sudah dibuang, item
      // berikutnya otomatis "geser" ke posisi i.
    } else {
      i += 1; // template ini lagi habis jatah, coba item berikutnya di antrian
    }
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
    queue.unshift({ id, template_wa: row.template_wa });
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
  const pendingEntries = await listQueuedMessageLogQueueEntries();
  queue = [...pendingEntries, ...queue];
  if (pendingEntries.length > 0) {
    console.log(
      `[queueService] Memuat ulang ${pendingEntries.length} pesan yang masih 'antri' dari sebelum restart terakhir.`
    );
  }
  ensureRefillTimerRunning();
  ensureTemplateGlobalRefillTimerRunning();
  drainQueue();
}
