// v3.2: setiap pesan masuk (event "message" dari webhook GOWA) dicatat di
// sini SEBAGAI AUDIT TRAIL MENTAH -- terlepas dari apakah itu balasan
// Approve/Reject yang valid, balasan lain, atau bahkan pesan baru (bukan
// balasan sama sekali). Dipakai untuk fitur Approve/Reject (mencocokkan ke
// message_logs lewat replied_to_id), tapi juga berguna sebagai log/riwayat
// "Received Message" secara umum.

import { pool } from "../db.js";

/**
 * Simpan satu pesan masuk. `matchedMessageLogId` diisi kalau pesan ini
 * berhasil dicocokkan sebagai balasan ke salah satu baris di message_logs
 * (lewat replied_to_id <-> provider_message_id), null kalau tidak.
 */
export async function addReceivedMessage({
  waMessageId,
  chatId,
  fromWa,
  fromName,
  body,
  repliedToId,
  matchedMessageLogId = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO received_messages
       (wa_message_id, chat_id, from_wa, from_name, body, replied_to_id, matched_message_log_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [waMessageId ?? null, chatId ?? null, fromWa ?? null, fromName ?? null, body ?? null, repliedToId ?? null, matchedMessageLogId]
  );
  return rows[0];
}

/** Riwayat pesan masuk, terbaru dulu. Bisa dipakai untuk halaman "Received Message" di dashboard. */
export async function listReceivedMessages(limit = 200) {
  const { rows } = await pool.query(
    "SELECT * FROM received_messages ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}
