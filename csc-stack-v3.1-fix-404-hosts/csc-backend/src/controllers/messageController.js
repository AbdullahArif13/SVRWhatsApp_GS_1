import { findTemplateByName, findAnyTemplateByName } from "../data/templates.js";
import { extractVariableNames, buildFinalMessage, findMissingVariables } from "../utils/templateEngine.js";
import { listMessageLogs, findMessageLogById } from "../data/messageLogs.js";
import { upsertContactFromMessage } from "../data/contacts.js";
import { enqueueMessage, getQueuePosition, estimateWaitSeconds, getCircuitBreakerStatus } from "../services/queueService.js";
import { buildUploadedPhotoUrl } from "../middleware/uploadPhoto.js";
import { logActivity, actorFromRequest } from "../data/activityLogs.js";

// Field top-level yang SELALU ada di luar "values" -- dipakai buat
// misahkan mana field top-level vs mana yang jadi isi {{variabel}}, waktu
// request-nya berbentuk multipart/form-data (field-nya flat, tidak ada
// object "values" bersarang kayak JSON biasa). Lihat handleSendMessage.
const TOP_LEVEL_FIELDS = new Set(["template_wa", "no_wa", "nama_wa"]);

// Nomor WA: cuma digit, boleh diawali "+", panjang wajar (Indonesia &
// internasional pada umumnya 8-15 digit).
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

// JID grup WhatsApp (whatsmeow/GOWA): "<id_numerik>@g.us", atau format
// lama "<nomor_pembuat>-<timestamp>@g.us" (grup yang dibuat sebelum
// WhatsApp migrasi ke ID grup acak). Kirim ke grup pakai JID ini
// langsung di field 'no_wa' -- dapatkan lewat GOWA GET /user/my/groups.
const GROUP_JID_PATTERN = /^[0-9]+(-[0-9]+)?@g\.us$/;

// Batas jumlah key & panjang tiap value di object "values", supaya orang
// tidak bisa kirim payload raksasa buat DoS (isi memory/DB dengan JSON
// yang gede banget).
const MAX_VALUES_KEYS = 30;
const MAX_VALUE_LENGTH = 2000;

// "foto" di dalam `values` adalah key RESERVED (dicek case-insensitive,
// konsisten dengan gaya pencocokan key lain di codebase ini -- lihat
// guessRecipientName() di data/messageLogs.js) -- kalau diisi, dipakai
// queueService.js untuk mengirim PESAN FOTO TERPISAH lewat GOWA
// (POST /send/image) setelah pesan teks template terkirim, bukan sekadar
// disubstitusikan sebagai teks {{foto}} biasa. Fitur ini dibuat untuk
// notifikasi CCTV AI Vision/SHE (lihat contoh template "SHE-CCTV-AI-MASKER").
// Template yang TIDAK mengisi "foto" di `values` perilakunya SAMA PERSIS
// seperti sebelum fitur ini ada.
const IMAGE_URL_KEY = "foto";

/** Cari value suatu key di object `values` tanpa peduli besar/kecil huruf key-nya. */
function findValueCaseInsensitive(values, key) {
  if (!values || typeof values !== "object") return undefined;
  const entry = Object.entries(values).find(([k]) => k.toLowerCase() === key);
  return entry ? entry[1] : undefined;
}

/** Hapus key tertentu dari object `values` tanpa peduli besar/kecil huruf key-nya (in-place). */
function deleteKeyCaseInsensitive(values, key) {
  if (!values || typeof values !== "object") return;
  for (const k of Object.keys(values)) {
    if (k.toLowerCase() === key) delete values[k];
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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

  // Kalau "foto" diisi, GOWA cuma menerima link http(s) yang bisa diakses
  // langsung (bukan base64) -- lihat services/waService.js:sendWhatsAppImage.
  const fotoValue = findValueCaseInsensitive(values, IMAGE_URL_KEY);
  if (fotoValue !== undefined && String(fotoValue).trim() !== "" && !isHttpUrl(fotoValue)) {
    return "Field 'values.foto' harus berupa URL gambar yang valid (diawali http:// atau https://), bukan base64/path lokal.";
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
 * KIRIM KE GRUP: isi "no_wa" dengan JID grup ("<id>@g.us", lihat
 * GROUP_JID_PATTERN), bukan nomor HP -- dapatkan JID grup lewat GOWA
 * GET /user/my/groups (daftar semua grup yang device WA-nya ikuti).
 * Contoh: "no_wa": "120363399064305127@g.us". Kalau ini yang dipakai,
 * "nama_wa" tetap wajib diisi (dipakai label di Riwayat Pengiriman), tapi
 * TIDAK otomatis kesimpen ke tabel kontak (grup bukan kontak personal).
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
 *
 * FITUR "KIRIM FOTO" (mis. notifikasi CCTV AI Vision/SHE) -- "values.foto"
 * dan "values.keterangan" adalah key RESERVED (opsional, dicek case-
 * insensitive):
 *   - "values.foto"       : URL http(s) gambar yang bisa diakses langsung
 *                             oleh server GOWA (BUKAN base64/path lokal).
 *                             Kalau diisi, backend mengirim GAMBAR ini
 *                             sebagai PESAN KEDUA ke GOWA (POST /send/image)
 *                             setelah pesan teks template di atas berhasil
 *                             terkirim -- lihat services/queueService.js &
 *                             services/waService.js:sendWhatsAppImage.
 *   - "values.keterangan" : dipakai sebagai CAPTION pesan foto di atas
 *                             (opsional, boleh kosong).
 * Template yang tidak mengisi "values.foto" perilakunya SAMA PERSIS seperti
 * sebelum fitur ini ada (hanya kirim 1 pesan teks seperti biasa).
 *
 * Contoh untuk template "SHE-CCTV-AI-MASKER" (notifikasi CCTV AI):
 *   {
 *     "template_wa": "SHE-CCTV-AI-MASKER",
 *     "no_wa": "<nomor_tujuan>",
 *     "nama_wa": "<nama_penerima>",
 *     "values": {
 *       "pelanggaran": "Penggunaan Masker Tidak Benar / Tidak Pakai Masker",
 *       "sumber": "CCTV AI Vision",
 *       "waktu": "29 Juli 2026 10:23:45 WIB",
 *       "lokasi": "Line 3 - Area Mixing",
 *       "tipe_pelanggaran": "Tidak memakai masker",
 *       "tingkat_risiko": "MEDIUM",
 *       "keterangan": "Mohon ditindaklanjuti segera dan pastikan penggunaan APD sesuai ketentuan.\n\nTerima kasih.",
 *       "foto": "https://storage.internal/cctv/snapshot123.jpg"
 *     }
 *   }
 *
 * ALTERNATIF (v3.8) -- kirim file foto LANGSUNG (JPG/PNG) tanpa perlu host
 * URL sendiri dulu: kirim sebagai `multipart/form-data` (BUKAN JSON), field
 * "foto" berisi file-nya, field lain (template_wa, no_wa, nama_wa, dan tiap
 * {{variabel}} template) dikirim FLAT (tanpa dibungkus "values"), contoh:
 *
 *   curl -X POST .../api/send-message \
 *     -H "X-API-Key: ..." \
 *     -F "template_wa=SHE-CCTV-AI-MASKER" \
 *     -F "no_wa=628xxxxxxxxx" \
 *     -F "nama_wa=PIC Line 3" \
 *     -F "pelanggaran=..." -F "sumber=..." -F "waktu=..." \
 *     -F "lokasi=..." -F "tipe_pelanggaran=..." -F "tingkat_risiko=..." \
 *     -F "keterangan=..." \
 *     -F "foto=@/path/snapshot.jpg;type=image/jpeg"
 *
 * Backend simpan file itu (lihat middleware/uploadPhoto.js), ubah jadi URL
 * internal (http://backend:3001/uploads/photos/xxx.jpg -- reachable dari
 * GOWA lewat jaringan Docker), lalu perlakuannya SAMA PERSIS dengan kalau
 * values.foto diisi URL manual (termasuk tetap tunduk ke toggle "Aktifkan
 * Penggunaan Foto" template -- lihat langkah 3b di bawah).
 */
export async function handleSendMessage(req, res) {
  // v3.8: dua bentuk request didukung --
  //   - JSON biasa (Content-Type: application/json) -> req.body.values
  //     sudah berupa object bersarang seperti sebelumnya, TIDAK berubah.
  //   - multipart/form-data (lihat uploadPhoto.js) -> semua field selain
  //     template_wa/no_wa/nama_wa otomatis jadi isi "values" yang dibentuk
  //     di sini, dan file di field "foto" (kalau ada, lewat req.file) jadi
  //     values.foto berupa URL internal.
  const isMultipart = req.is("multipart/form-data");
  let template_wa, no_wa, nama_wa, values;

  if (isMultipart) {
    const body = req.body ?? {};
    template_wa = body.template_wa;
    no_wa = body.no_wa;
    nama_wa = body.nama_wa;
    values = {};
    for (const [key, value] of Object.entries(body)) {
      if (!TOP_LEVEL_FIELDS.has(key)) values[key] = value;
    }
    if (req.file) {
      values.foto = buildUploadedPhotoUrl(req.file.filename);
    }
  } else {
    ({ template_wa, no_wa, nama_wa, values } = req.body ?? {});
  }

  // 1. Validasi field wajib.
  if (!template_wa || typeof template_wa !== "string") {
    return res.status(400).json({ success: false, message: "Field 'template_wa' wajib diisi." });
  }
  if (!no_wa || typeof no_wa !== "string") {
    return res.status(400).json({ success: false, message: "Field 'no_wa' wajib diisi." });
  }
  // Kirim ke GRUP: no_wa berupa JID "...@g.us" (lihat GROUP_JID_PATTERN di
  // atas) -- dipakai APA ADANYA, TIDAK boleh melalui pembersihan tanda "-"
  // di bawah (format lama JID grup justru mengandung "-" yang wajib
  // dipertahankan persis).
  const isGroupTarget = GROUP_JID_PATTERN.test(no_wa.trim());
  const cleanedNoWa = isGroupTarget ? no_wa.trim() : no_wa.replace(/[\s()-]/g, "");
  if (!isGroupTarget && !PHONE_PATTERN.test(cleanedNoWa)) {
    return res.status(400).json({ success: false, message: "Format 'no_wa' tidak valid (nomor HP 8-15 digit, atau JID grup '...@g.us')." });
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
  //
  //     Dilewati untuk tujuan GRUP (isGroupTarget) -- grup bukan kontak
  //     personal, dan JID grup tidak masuk akal disimpan di tabel `contacts`
  //     (yang kolomnya memang untuk nomor HP perorangan).
  if (!isGroupTarget) {
    try {
      await upsertContactFromMessage({ no_wa: cleanedNoWa, nama_wa });
    } catch (error) {
      console.error("[handleSendMessage] Gagal simpan kontak otomatis:", error?.message ?? error);
    }
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

  // 3b. Fitur "Aktifkan Penggunaan Foto" (toggle di halaman Create
  //     Template, kolom `use_photo`) -- INI yang membuat toggle-nya
  //     benar-benar berarti, bukan cuma dokumentasi:
  //       - use_photo = true  -> `values.foto` WAJIB diisi (URL gambar,
  //                              format sudah dicek di validateValuesPayload
  //                              di atas), kalau tidak diisi request DITOLAK.
  //       - use_photo = false -> `values.foto`/`values.keterangan` --
  //                              SEKALIPUN dikirim oleh pemanggil -- SENGAJA
  //                              DIABAIKAN di sini (dihapus dari values
  //                              sebelum diteruskan), supaya template yang
  //                              belum mengaktifkan foto tidak bisa
  //                              "kebobolan" kirim gambar.
  const effectiveValues = { ...(values ?? {}) };
  if (template.use_photo) {
    const fotoValue = findValueCaseInsensitive(effectiveValues, IMAGE_URL_KEY);
    if (fotoValue === undefined || String(fotoValue).trim() === "") {
      return res.status(400).json({
        success: false,
        message: `Template '${template.name}' mengaktifkan Penggunaan Foto -- field 'values.foto' (URL gambar) wajib diisi.`,
      });
    }
  } else {
    deleteKeyCaseInsensitive(effectiveValues, IMAGE_URL_KEY);
    deleteKeyCaseInsensitive(effectiveValues, "keterangan");
  }

  // 4. Isi template dengan values yang dikirim.
  //    buildFinalMessage otomatis menambahkan kalimat instruksi
  //    "...ketik Approve atau Reject" di akhir pesan kalau
  //    template.require_reply = true -- berlaku untuk template MANA PUN
  //    (tidak lagi tergantung apakah kalimat itu diketik manual di body).
  const finalMessage = buildFinalMessage(template.body, effectiveValues, template.require_reply);

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
      values: effectiveValues,
      finalMessage,
      requireReply: template.require_reply,
    });

    logActivity({
      actor: actorFromRequest(req),
      action: "send_message",
      entityType: "message",
      entityId: row.id,
      detail: { template_wa: template.name, no_wa, nama_wa },
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
      use_photo: template.use_photo,
      // v3.9: kasih tahu pemanggil kalau circuit breaker sedang aktif
      // (pengiriman baru sementara dijeda, mis. GOWA/sesi WA lagi
      // bermasalah) -- pesan ini TETAP masuk antrian & tidak hilang,
      // cuma bakal ditunda sampai jeda berakhir.
      circuit_breaker: getCircuitBreakerStatus(),
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
