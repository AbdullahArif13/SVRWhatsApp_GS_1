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

/**
 * Mencatat satu percobaan pengiriman (berhasil atau gagal) ke riwayat.
 * Dipanggil dari `messageController.js` setelah `sendWhatsAppMessage`
 * selesai (baik sukses maupun error).
 *
 * `providerMessageId` : ID pesan dari GOWA (results.message_id), kosong
 *                        kalau pengiriman gagal.
 * `requireReply`       : disalin dari templates.require_reply PADA SAAT
 *                        pesan ini dikirim (lihat catatan di db/schema.sql).
 */
export async function addMessageLog({
  template_wa,
  no_wa,
  nama_wa,
  values,
  final_message,
  status,
  error_message,
  providerMessageId = null,
  requireReply = false,
}) {
  const recipientName = nama_wa ?? guessRecipientName(values);
  // Kalau template ini butuh balasan Approve/Reject DAN pesannya berhasil
  // terkirim, statusnya mulai dari "menunggu". Selain itu (tidak butuh
  // balasan, atau gagal terkirim), "tidak_diperlukan".
  const initialReplyStatus = requireReply && status === "terkirim" ? "menunggu" : "tidak_diperlukan";

  const { rows } = await pool.query(
    `INSERT INTO message_logs
       (template_wa, no_wa, nama_wa, recipient_name, values_json, final_message,
        status, error_message, provider_message_id, require_reply, reply_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      template_wa,
      no_wa,
      nama_wa ?? null,
      recipientName,
      JSON.stringify(values ?? {}),
      final_message,
      status,
      error_message ?? null,
      providerMessageId,
      Boolean(requireReply),
      initialReplyStatus,
    ]
  );
  return mapRow(rows[0]);
}

/** Mengambil seluruh riwayat, terbaru lebih dulu. Dipakai GET /api/messages. */
export async function listMessageLogs() {
  const { rows } = await pool.query("SELECT * FROM message_logs ORDER BY created_at DESC");
  return rows.map(mapRow);
}

/**
 * Cari satu baris kiriman berdasarkan provider_message_id (ID pesan dari
 * GOWA). Dipakai webhookController.js untuk mencocokkan `replied_to_id`
 * dari balasan user ke kiriman template mana ia membalas.
 */
export async function findMessageLogByProviderMessageId(providerMessageId) {
  if (!providerMessageId) return null;
  const { rows } = await pool.query(
    "SELECT * FROM message_logs WHERE provider_message_id = $1 ORDER BY created_at DESC LIMIT 1",
    [providerMessageId]
  );
  return mapRow(rows[0] ?? null);
}

/**
 * Set hasil Approve/Reject (atau balasan tidak valid, tetap "menunggu")
 * untuk satu baris kiriman. Dipanggil webhookController.js begitu balasan
 * user berhasil dicocokkan & di-parse.
 */
export async function setMessageLogReply(id, { replyStatus, replyRawText }) {
  const { rows } = await pool.query(
    `UPDATE message_logs
       SET reply_status = $1, reply_raw_text = $2, replied_at = now()
     WHERE id = $3
     RETURNING *`,
    [replyStatus, replyRawText, id]
  );
  return mapRow(rows[0] ?? null);
}
