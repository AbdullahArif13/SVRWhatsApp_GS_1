import { pool } from "../db.js";

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

export async function listReceivedMessages(limit = 200) {
  const { rows } = await pool.query(
    "SELECT * FROM received_messages ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}
