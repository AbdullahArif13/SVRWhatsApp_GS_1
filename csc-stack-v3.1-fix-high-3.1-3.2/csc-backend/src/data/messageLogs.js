// Riwayat setiap request yang masuk ke POST /api/send-message -- baik yang
// berhasil maupun yang gagal -- supaya FrontEnd bisa menampilkan "ke mana
// saja arah dari sistem permintaan ke orang yang dituju".
//
// v3.2: PINDAH dari in-memory (array biasa, hilang tiap restart) ke tabel
// `message_logs` di PostgreSQL, karena sekarang baris ini juga jadi
// "jangkar" fitur Approve/Reject -- begitu user membalas pesan WA, GOWA
// mengirim webhook berisi `replied_to_id` (ID pesan yang dibalas), dan kita
// perlu mencocokkannya ke `provider_message_id` di sini WALAU backend
// sempat restart di antara pesan terkirim & balasannya datang.

import { pool } from "../db.js";

/**
 * Kandidat nama key di dalam `values` yang kemungkinan berisi nama
 * penerima pesan. Dicek case-insensitive, karena nama variabel bisa beda
 * antar template (mis. {{nama}} vs {{Nama_Penerima}}).
 */
const RECIPIENT_NAME_KEYS = ["nama", "name", "penerima", "recipient", "recipient_name", "nama_penerima"];

function guessRecipientName(values = {}) {
  const lowerCaseValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );
  for (const key of RECIPIENT_NAME_KEYS) {
    if (lowerCaseValues[key]) return lowerCaseValues[key];
  }
  return null;
}

function mapRow(row) {
  if (!row) return row;
  return {
    ...row,
    values: row.values_json ?? {},
  };
}

export async function addQueuedMessageLog({
  template_wa,
  no_wa,
  nama_wa,
  values,
  final_message,
  requireReply = false,
}) {
  const recipientName = nama_wa ?? guessRecipientName(values);

  const { rows } = await pool.query(
    `INSERT INTO message_logs
       (template_wa, no_wa, nama_wa, recipient_name, values_json, final_message,
        status, require_reply, reply_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'antri', $7, 'tidak_diperlukan')
     RETURNING *`,
    [
      template_wa,
      no_wa,
      nama_wa ?? null,
      recipientName,
      JSON.stringify(values ?? {}),
      final_message,
      Boolean(requireReply),
    ]
  );
  return mapRow(rows[0]);
}

/**
 * Update baris ANTRIAN begitu queueService SELESAI mencoba mengirimnya
 * ke GOWA (berhasil atau gagal). Dipanggil dari queueService.processNext(),
 * BUKAN langsung dari messageController.js.
 */
export async function updateMessageLogResult(id, { status, providerMessageId = null, errorMessage = null }) {
  const { rows } = await pool.query(
    `UPDATE message_logs
       SET status = $1::varchar,
           provider_message_id = COALESCE($2, provider_message_id),
           error_message = $3,
           -- Kalau template ini butuh Approve/Reject DAN akhirnya beneran
           -- terkirim, reply_status baru mulai "menunggu" SEKARANG --
           -- selama masih 'antri' tadinya tetap 'tidak_diperlukan' (belum
           -- relevan, wong belum dikirim).
           --
           -- CATATAN PENTING: $1 di-cast eksplisit ke ::varchar DI KEDUA
           -- tempat pemakaiannya (assignment kolom DI ATAS, dan
           -- perbandingan DI BAWAH ini). Tanpa cast ini, PostgreSQL akan
           -- gagal total dengan error "inconsistent types deduced for
           -- parameter $1" karena parameter yang sama dipakai di dua
           -- konteks inferensi tipe yang berbeda (assignment vs
           -- perbandingan) -- query GAGAL, status baris TIDAK PERNAH
           -- ter-update jadi 'terkirim' walau pesannya sudah beneran
           -- terkirim ke GOWA, dan pesan itu akan DIKIRIM ULANG tiap
           -- backend restart (baris masih kebaca 'antri'). Kalau ada
           -- query lain yang dibuat belakangan dengan pola serupa
           -- (parameter sama dipakai di assignment DAN perbandingan),
           -- WAJIB di-cast eksplisit juga seperti ini.
           reply_status = CASE
             WHEN require_reply AND $1::varchar = 'terkirim' THEN 'menunggu'
             ELSE reply_status
           END
     WHERE id = $4
     RETURNING *`,
    [status, providerMessageId, errorMessage, id]
  );
  return mapRow(rows[0] ?? null);
}

export async function listQueuedMessageLogIds() {
  const { rows } = await pool.query(
    "SELECT id FROM message_logs WHERE status = 'antri' ORDER BY created_at ASC"
  );
  return rows.map((row) => row.id);
}

/** Satu baris riwayat berdasarkan id -- dipakai worker antrian & endpoint polling status. */
export async function findMessageLogById(id) {
  const { rows } = await pool.query("SELECT * FROM message_logs WHERE id = $1", [id]);
  return mapRow(rows[0] ?? null);
}

/** Mengambil seluruh riwayat, terbaru lebih dulu. Dipakai GET /api/messages. */
export async function listMessageLogs() {
  const { rows } = await pool.query("SELECT * FROM message_logs ORDER BY created_at DESC");
  return rows.map(mapRow);
}

export async function findMessageLogByProviderMessageId(providerMessageId) {
  if (!providerMessageId) return null;
  const { rows } = await pool.query(
    "SELECT * FROM message_logs WHERE provider_message_id = $1 ORDER BY created_at DESC LIMIT 1",
    [providerMessageId]
  );
  return mapRow(rows[0] ?? null);
}

export async function setMessageLogReply(id, { replyStatus, replyRawText, replyReason = null }) {
  const { rows } = await pool.query(
    `UPDATE message_logs
       SET reply_status = $1, reply_raw_text = $2, reply_reason = $3, replied_at = now()
     WHERE id = $4
     RETURNING *`,
    [replyStatus, replyRawText, replyReason, id]
  );
  return mapRow(rows[0] ?? null);
}