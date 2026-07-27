import { findTemplateByName, findAnyTemplateByName } from "../data/templates.js";
import { extractVariableNames, buildFinalMessage, findMissingVariables } from "../utils/templateEngine.js";
import { listMessageLogs, findMessageLogById } from "../data/messageLogs.js";
import { upsertContactFromMessage } from "../data/contacts.js";
import { enqueueMessage, getQueuePosition, estimateWaitSeconds } from "../services/queueService.js";

const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const MAX_VALUES_KEYS = 30;
const MAX_VALUE_LENGTH = 2000;

function validateValuesPayload(values) {
  if (values === undefined) return null;
  if (typeof values !== "object" || Array.isArray(values) || values === null) {
    return "Field 'values' harus berupa object.";
  }
  const keys = Object.keys(values);
  if (keys.length > MAX_VALUES_KEYS) {
    return `Field 'values' maksimal ${MAX_VALUES_KEYS} variabel.`;
  }
  for (const key of keys) {
    const val = values[key];
    if (typeof val !== "string" && typeof val !== "number") {
      return `Nilai variabel '${key}' harus berupa teks/angka.`;
    }
    if (String(val).length > MAX_VALUE_LENGTH) {
      return `Nilai variabel '${key}' terlalu panjang (maks ${MAX_VALUE_LENGTH} karakter).`;
    }
  }
  return null;
}

/**
 * POST /api/send-message
 *
 * v3.6: pesan dikirim ke GOWA LANGSUNG SAAT ITU JUGA selama rate limit
 * (QUEUE_RATE_LIMIT_PER_MINUTE, default 30/menit) belum terlampaui --
 * BARU masuk antrian FIFO beneran kalau jatah rate limit-nya lagi habis
 * (lihat services/queueService.js, pola "token bucket"). Jadi kalau
 * sistem eksternal cuma kirim sesekali/di bawah limit, pengalamannya
 * kurang lebih SAMA kayak sebelum ada antrian (nyaris instan) -- antrian
 * cuma "kelihatan" begitu benar-benar ada lonjakan yang melebihi limit.
 *
 * Response endpoint ini tetap 202 Accepted + `queue_id` di KEDUA kasus
 * (supaya kontraknya konsisten, tidak tergantung sedang ngantri atau
 * tidak) -- tapi field `status` di response itu cuma status AWAL
 * ('antri' sesaat sebelum diproses). Pemanggil (sistem eksternal) tetap
 * disarankan polling GET /api/messages/:id kalau mau tau status akhirnya
 * ('terkirim'/'gagal') secara pasti, walau kalau lagi di bawah limit
 * biasanya sudah berubah dalam hitungan milidetik.
 *
 * Body yang diterima BUKAN struktur statis per template, tapi:
 *   {
 *     "template_wa": "<nama_template>",   // wajib, selalu ada
 *     "no_wa": "<nomor_tujuan>",          // wajib, selalu ada
 *     "values": { ...bebas sesuai template... }  // dinamis
 *   }
 *
 * Contoh untuk template "spct_order":
 *   {
 *     "template_wa": "spct_order",
 *     "no_wa": "089189182",
 *     "nama_wa": "Bapak Fauzi",
 *     "values": {
 *       "nama": "Abdullah",
 *       "nomor_request": "CSC/01",
 *       "requester": "Masker",
 *       "item": "N96"
 *     }
 *   }
 *
 * PENTING (v3) -- "nama_wa" vs "values.nama":
 *   - "nama_wa"      : nama kontak WA tujuan (dipakai untuk ditampilkan di
 *                       Riwayat Pengiriman / Chat, SAMA SEKALI TIDAK dipakai
 *                       untuk mengisi {{...}} di body template).
 *   - "values.nama"  : isi untuk placeholder {{nama}} di body template itu
 *                       sendiri. Isinya boleh sama persis dengan "nama_wa"
 *                       (umumnya memang sama), tapi keduanya field terpisah
 *                       -- "nama_wa" wajib ada di payload, sedangkan
 *                       "values.nama" hanya perlu diisi kalau body template
 *                       yang dipakai memang punya placeholder {{nama}}.
 *
 * Kalau template_wa ganti ke template lain, field di dalam "values" ikut
 * berubah bebas -- endpoint ini tidak perlu diubah kodenya, karena nama
 * variabel diambil otomatis dari body template (bukan hardcode).
 */
export async function handleSendMessage(req, res) {
  const { template_wa, no_wa, nama_wa, values } = req.body ?? {};

  // 1. Validasi field wajib.
  if (!template_wa || typeof template_wa !== "string") {
    return res.status(400).json({ success: false, message: "Field 'template_wa' wajib diisi." });
  }
  if (!no_wa || typeof no_wa !== "string") {
    return res.status(400).json({ success: false, message: "Field 'no_wa' wajib diisi." });
  }
  const cleanedNoWa = no_wa.replace(/[\s()-]/g, "");
  if (!PHONE_PATTERN.test(cleanedNoWa)) {
    return res.status(400).json({ success: false, message: "Format 'no_wa' tidak valid." });
  }
  if (!nama_wa || typeof nama_wa !== "string" || !nama_wa.trim()) {
    return res.status(400).json({ success: false, message: "Field 'nama_wa' wajib diisi." });
  }
  if (nama_wa.length > 255) {
    return res.status(400).json({ success: false, message: "Field 'nama_wa' terlalu panjang." });
  }
  const valuesError = validateValuesPayload(values);
  if (valuesError) {
    return res.status(400).json({ success: false, message: valuesError });
  }

  // 1b. Simpan/update kontak dari no_wa + nama_wa yang dikirim di body ini
  //     (v3: "Add Contact" otomatis -- tidak perlu di-add manual lagi lewat
  //     dashboard tiap kali sistem lain kirim WA lewat backend ini).
  //     Sengaja dijalankan di sini, SEBELUM cek template_wa / values di
  //     bawah, supaya kontaknya tetap kesimpen walau ternyata template_wa-nya
  //     salah/tidak ditemukan -- yang penting no_wa & nama_wa sudah valid.
  //     Kalau langkah ini gagal (mis. DB lagi bermasalah), JANGAN sampai
  //     menggagalkan pengiriman pesan yang sebenarnya -- cukup dicatat di
  //     log server.
  try {
    await upsertContactFromMessage({ no_wa: cleanedNoWa, nama_wa });
  } catch (error) {
    console.error("[handleSendMessage] Gagal simpan kontak otomatis:", error?.message ?? error);
  }

  // 2. Cari template berdasarkan nama yang dikirim.
  //    (query ke MySQL di Docker, makanya di-await)
  const template = await findTemplateByName(template_wa);
  if (!template) {
    // findTemplateByName cuma mencari template yang masih is_active = 1.
    // Kalau template-nya ADA tapi sudah di-non-aktifkan (icon trash di
    // dashboard_tamplate), kasih pesan yang lebih jelas daripada "tidak
    // ditemukan" biasa.
    const anyTemplate = await findAnyTemplateByName(template_wa);
    if (anyTemplate && !anyTemplate.is_active) {
      return res.status(404).json({
        success: false,
        message: `Template '${template_wa}' sudah dinon-aktifkan di dashboard, tidak bisa dipakai untuk kirim pesan.`,
      });
    }
    return res.status(404).json({
      success: false,
      message: `Template '${template_wa}' tidak ditemukan.`,
    });
  }

  // 3. Cek apakah semua {{variabel}} yang dibutuhkan template ini sudah
  //    ada isinya di 'values'. Ini yang membuat validasi tetap dinamis --
  //    daftar variabel wajib diambil dari body template itu sendiri.
  const missing = findMissingVariables(template.body, values ?? {});
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Variabel berikut belum diisi: ${missing.join(", ")}`,
      required_variables: extractVariableNames(template.body),
      missing_variables: missing,
    });
  }

  // 4. Isi template dengan values yang dikirim.
  //    buildFinalMessage otomatis menambahkan kalimat instruksi
  //    "...ketik Approve atau Reject" di akhir pesan kalau
  //    template.require_reply = true -- berlaku untuk template MANA PUN
  //    (tidak lagi tergantung apakah kalimat itu diketik manual di body).
  const finalMessage = buildFinalMessage(template.body, values ?? {}, template.require_reply);

  // 5. v3.6: kirim SEKARANG JUGA kalau jatah rate limit masih ada (lihat
  //    queueService.js) -- BARU beneran masuk antrian FIFO kalau jatahnya
  //    lagi habis. Response ini tetap 202 + queue_id di kedua kasus
  //    (kontraknya sama), tapi begitu pemanggil polling ke check_status_url,
  //    kalau tadi "immediate", status-nya kemungkinan besar SUDAH
  //    'terkirim'/'gagal' (bukan nyangkut lama di 'antri').
  try {
    const { row, position, estimatedWaitSeconds, immediate } = await enqueueMessage({
      template_wa: template.name,
      no_wa,
      nama_wa,
      values: values ?? {},
      finalMessage,
      requireReply: template.require_reply,
    });

    return res.status(202).json({
      success: true,
      message: immediate
        ? "Pesan diterima & langsung diproses (masih di bawah rate limit)."
        : "Pesan diterima & masuk antrian pengiriman (rate limit sedang penuh).",
      queue_id: row.id,
      status: row.status, // 'antri' -- cuma status AWAL, cek check_status_url buat status akhirnya
      queue_position: position,
      estimated_wait_seconds: estimatedWaitSeconds,
      template_used: template.name,
      require_reply: template.require_reply,
      check_status_url: `/api/messages/${row.id}`,
    });
  } catch (error) {
    if (error?.code === "QUEUE_FULL") {
      return res.status(429).json({ success: false, message: error.message });
    }
    console.error("[handleSendMessage] Gagal memasukkan pesan ke antrian:", error?.message ?? error);
    return res.status(500).json({
      success: false,
      message: "Gagal memasukkan pesan ke antrian.",
    });
  }
}

/**
 * GET /api/messages
 *
 * Riwayat semua pengiriman (berhasil maupun gagal) yang pernah masuk lewat
 * POST /api/send-message. Dipakai FrontEnd untuk menampilkan "ke mana saja
 * arah dari sistem permintaan ke orang yang dituju" -- FrontEnd sendiri
 * tidak pernah memicu pengiriman, hanya menampilkan riwayatnya.
 */
export async function handleListMessages(_req, res) {
  return res.status(200).json({
    success: true,
    data: await listMessageLogs(),
  });
}

/**
 * GET /api/messages/:id
 *
 * Endpoint POLLING buat sistem eksternal -- setelah POST /api/send-message
 * membalas 202 (masuk antrian), pemanggil kembali ke sini pakai `queue_id`
 * yang didapat, buat tau status akhirnya sudah 'terkirim'/'gagal' atau
 * masih 'antri'. Kalau masih 'antri', ikut dikembalikan posisi & perkiraan
 * waktu tunggunya.
 */
export async function handleGetMessageStatus(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "id tidak valid." });
  }

  const log = await findMessageLogById(id);
  if (!log) {
    return res.status(404).json({ success: false, message: `Pesan dengan id ${id} tidak ditemukan.` });
  }

  const payload = { success: true, data: log };
  if (log.status === "antri") {
    const position = getQueuePosition(id);
    payload.queue_position = position;
    payload.estimated_wait_seconds = estimateWaitSeconds(position);
  }
  return res.status(200).json(payload);
}

/**
 * GET /api/templates/:name/variables
 *
 * Endpoint bantu untuk frontend: supaya frontend bisa tahu variabel apa
 * saja yang harus diminta ke user untuk template tertentu, tanpa perlu
 * hardcode daftar variabel di sisi frontend juga.
 */
export async function handleGetTemplateVariables(req, res) {
  const template = await findTemplateByName(req.params.name);
  if (!template) {
    return res.status(404).json({ success: false, message: `Template '${req.params.name}' tidak ditemukan.` });
  }

  return res.status(200).json({
    success: true,
    template_name: template.name,
    variables: extractVariableNames(template.body),
  });
}
