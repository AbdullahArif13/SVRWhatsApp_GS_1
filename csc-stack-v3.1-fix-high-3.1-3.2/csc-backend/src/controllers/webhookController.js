import { addReceivedMessage } from "../data/receivedMessages.js";
import { findMessageLogByProviderMessageId, setMessageLogReply } from "../data/messageLogs.js";
import { parseApproveReject } from "../utils/replyParser.js";
import { sendWhatsAppMessage } from "../services/waService.js";

const THANK_YOU_MESSAGE =
  "Terima kasih telah merespons pesannya";
const INVALID_REPLY_REMINDER =
  'Maaf, balasan kamu belum kami kenali. Mohon balas pesan sebelumnya dengan mengetik *Y* atau *N* saja ya (tanpa kata tambahan lain).';

async function sendAutoReply(noWa, message) {
  try {
    await sendWhatsAppMessage(noWa, message);
  } catch (err) {
    console.warn(`[webhook] Gagal kirim balasan otomatis ke ${noWa}: ${err.message}`);
  }
}

export async function handleWhatsAppWebhook(req, res) {
  const { event, payload } = req.body ?? {};
  if (event !== "message" || !payload || payload.is_from_me) {
    return res.status(200).json({ success: true, ignored: true });
  }

  const repliedToId = payload.replied_to_id || null;

  let matchedLog = null;
  if (repliedToId) {
    matchedLog = await findMessageLogByProviderMessageId(repliedToId);
  }

  const received = await addReceivedMessage({
    waMessageId: payload.id,
    chatId: payload.chat_id,
    fromWa: payload.from,
    fromName: payload.from_name,
    body: payload.body,
    repliedToId,
    matchedMessageLogId: matchedLog?.id ?? null,
  });

  if (matchedLog && matchedLog.require_reply) {
    const { decision, reason } = parseApproveReject(payload.body);

    if (decision) {
      await setMessageLogReply(matchedLog.id, {
        replyStatus: decision,
        replyRawText: payload.body ?? null,
        replyReason: reason,
      });

      await sendAutoReply(payload.from, THANK_YOU_MESSAGE);
    } else {
      console.warn(
        `[webhook] Balasan ke pesan ${repliedToId} bukan "Approve"/"Reject" yang valid: "${payload.body}"`
      );
      await sendAutoReply(payload.from, INVALID_REPLY_REMINDER);
    }
  }

  return res.status(200).json({ success: true, received_id: received.id, matched: Boolean(matchedLog) });
}
