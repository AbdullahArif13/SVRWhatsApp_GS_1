import { addReceivedMessage } from "../data/receivedMessages.js";
import { findMessageLogByProviderMessageId, setMessageLogReply } from "../data/messageLogs.js";
import { parseApproveReject } from "../utils/replyParser.js";
import { sendWhatsAppMessage } from "../services/waService.js";

// Pesan balasan otomatis yang dikirim BALIK ke penerima (bukan ke sistem
// pemanggil /api/send-message) -- murni supaya penerima tahu balasannya
// sudah diterima/valid atau belum, tanpa perlu nunggu ditinjau manual.
const THANK_YOU_MESSAGE =
  "Terima kasih atas balasannya";
const INVALID_REPLY_REMINDER =
  'Maaf, balasan kamu belum kami kenali. Mohon balas pesan sebelumnya dengan mengetik *Y* atau *N* saja ya (tanpa kata tambahan lain).';

/**
 * Kirim balasan otomatis ke penerima, TANPA membuat webhook ini gagal
 * kalau pengiriman balasannya sendiri gagal (mis. GOWA lagi down) --
 * dicatat di log saja, webhook tetap balas 200 ke GOWA seperti biasa.
 */
async function sendAutoReply(noWa, message) {
  try {
    await sendWhatsAppMessage(noWa, message);
  } catch (err) {
    console.warn(`[webhook] Gagal kirim balasan otomatis ke ${noWa}: ${err.message}`);
  }
}

/**
 * POST /api/webhooks/whatsapp
 *
 * Endpoint yang dipanggil GOWA setiap ada event WhatsApp masuk (lihat
 * WHATSAPP_WEBHOOK di docker-compose.yml). Kita HANYA peduli event
 * "message" yang BUKAN dari kita sendiri (is_from_me = false) -- event
 * lain (message.ack, chat_presence, dll) diabaikan tapi tetap dibalas 200
 * supaya GOWA tidak retry terus-menerus.
 *
 * Alur fitur Approve/Reject:
 *  1. User membalas salah satu pesan yang dikirim lewat /api/send-message
 *     (nge-reply / quote pesan itu di WhatsApp).
 *  2. GOWA kirim webhook event "message" dengan `replied_to_id` = ID pesan
 *     yang dibalas (ini SAMA dengan `provider_message_id` yang kita simpan
 *     di message_logs pas awal kirim, lihat messageController.js).
 *  3. Setiap pesan masuk SELALU dicatat dulu di tabel received_messages
 *     (audit trail "Received Message" mentah, terlepas cocok atau tidak).
 *  4. Kalau replied_to_id cocok dengan salah satu baris message_logs YANG
 *     require_reply = true, isi balasannya (body) di-parse (lihat
 *     replyParser.js): harus DIAWALI kata "Approve" atau "Reject"
 *     (case-insensitive, boleh singkatan/sinonim seperti "Y"/"N").
 *     Khusus Reject, boleh diikuti alasan opsional, mis. "Reject, karena
 *     maskernya ada yang rusak" -> tersimpan sebagai reply_reason
 *     terpisah dari reply_status. Reject TANPA alasan juga tetap valid.
 *     - Cocok "Approve"/"Reject" -> message_logs.reply_status (+
 *       reply_reason kalau ada) di-update, lalu penerima dikirimi
 *       balasan ucapan terima kasih otomatis.
 *     - Tidak cocok / random text -> reply_status TETAP "menunggu", tapi
 *       tetap tercatat di received_messages (supaya bisa ditinjau manual),
 *       dan penerima dikirimi pengingat otomatis supaya balas ulang
 *       dengan mengetik "Approve" atau "Reject" saja.
 *
 * Pengiriman balasan otomatis (poin di atas) TIDAK memblokir/menggagalkan
 * response webhook ini -- kalau pengiriman balasannya sendiri gagal (mis.
 * GOWA down), webhook tetap balas 200 ke GOWA seperti biasa, cuma dicatat
 * warning di log.
 */
export async function handleWhatsAppWebhook(req, res) {
  const { event, payload } = req.body ?? {};

  // Selalu balas 200 cepat untuk event yang bukan "message" masuk dari
  // orang lain -- tidak ada yang perlu diproses lebih lanjut.
  if (event !== "message" || !payload || payload.is_from_me) {
    return res.status(200).json({ success: true, ignored: true });
  }

  const repliedToId = payload.replied_to_id || null;

  let matchedLog = null;
  if (repliedToId) {
    matchedLog = await findMessageLogByProviderMessageId(repliedToId);
  }

  // 3. Catat SEMUA pesan masuk sebagai audit trail, cocok atau tidak.
  const received = await addReceivedMessage({
    waMessageId: payload.id,
    chatId: payload.chat_id,
    fromWa: payload.from,
    fromName: payload.from_name,
    body: payload.body,
    repliedToId,
    matchedMessageLogId: matchedLog?.id ?? null,
  });

  // 4. Kalau ini balasan ke kiriman yang butuh Approve/Reject, coba proses.
  if (matchedLog && matchedLog.require_reply) {
    const { decision, reason } = parseApproveReject(payload.body);

    if (decision) {
      await setMessageLogReply(matchedLog.id, {
        replyStatus: decision,
        replyRawText: payload.body ?? null,
        replyReason: reason,
      });
      // Balasan valid (Approve/Reject) -- kirim ucapan terima kasih supaya
      // penerima tahu balasannya sudah masuk & tercatat.
      await sendAutoReply(payload.from, THANK_YOU_MESSAGE);
    } else {
      // Balasan tidak dikenali sebagai Approve/Reject -- reply_status
      // dibiarkan "menunggu", tapi raw text-nya tetap dicatat supaya bisa
      // ditinjau (mis. buat dashboard menampilkan "1 balasan tidak valid").
      // Penerima diingatkan supaya balas ulang dengan format yang benar,
      // bukan dibiarkan menunggu tanpa penjelasan.
      console.warn(
        `[webhook] Balasan ke pesan ${repliedToId} bukan "Approve"/"Reject" yang valid: "${payload.body}"`
      );
      await sendAutoReply(payload.from, INVALID_REPLY_REMINDER);
    }
  }

  return res.status(200).json({ success: true, received_id: received.id, matched: Boolean(matchedLog) });
}
