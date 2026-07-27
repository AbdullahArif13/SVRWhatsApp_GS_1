import { sendWhatsAppMessage, extractProviderMessageId } from "./waService.js";
import {
  addQueuedMessageLog,
  updateMessageLogResult,
  listQueuedMessageLogIds,
  findMessageLogById,
} from "../data/messageLogs.js";

const RATE_LIMIT_PER_MINUTE = Math.max(1, Number(process.env.QUEUE_RATE_LIMIT_PER_MINUTE) || 30);
const INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_PER_MINUTE);
const MAX_QUEUE_LENGTH = Math.max(1, Number(process.env.QUEUE_MAX_LENGTH) || 10_000);
let tokens = RATE_LIMIT_PER_MINUTE;

/** @type {number[]} id message_logs yang BENERAN nunggu giliran (jatah lagi habis), FIFO. */
let queue = [];
let refillTimer = null;

export function getQueueLength() {
  return queue.length;
}

export function getQueuePosition(id) {
  const index = queue.indexOf(id);
  return index === -1 ? null : index + 1;
}

export function estimateWaitSeconds(position) {
  if (!position || position < 1) return 0;
  return Math.round((position * INTERVAL_MS) / 1000);
}

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

  if (tokens > 0) {
    // Masih ada jatah -- KIRIM SEKARANG, tidak masuk antrian sama sekali.
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

/** Selama masih ada jatah DAN masih ada backlog di antrian, proses terus. */
function drainQueue() {
  while (tokens > 0 && queue.length > 0) {
    tokens -= 1;
    const id = queue.shift();
    processOne(id).catch((error) => {
      console.error(`[queueService] Error tak terduga memproses id=${id}:`, error?.message ?? error);
    });
  }
}

async function processOne(id) {
  const row = await findMessageLogById(id);
  if (!row) {
    console.warn(`[queueService] id=${id} seharusnya diproses tapi baris DB-nya tidak ketemu, dilewati.`);
    return;
  }

  try {
    const result = await sendWhatsAppMessage(row.no_wa, row.final_message);
    const providerMessageId = extractProviderMessageId(result);

    if (row.require_reply && !providerMessageId) {
      console.warn(
        `[queueService] id=${id}: template '${row.template_wa}' butuh balasan Approve/Reject, tapi provider tidak mengembalikan message_id -- balasan user nanti tidak akan bisa dicocokkan.`
      );
    }

    await updateMessageLogResult(id, { status: "terkirim", providerMessageId });
  } catch (error) {
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
