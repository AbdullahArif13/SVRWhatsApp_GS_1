import { sendWhatsAppMessage, sendWhatsAppImage, extractProviderMessageId, normalizePhoneDigits } from "./waService.js";
import {
  addQueuedMessageLog,
  updateMessageLogResult,
  listQueuedMessageLogQueueEntries,
  findMessageLogById,
} from "../data/messageLogs.js";

const RATE_LIMIT_PER_MINUTE = Math.max(1, Number(process.env.QUEUE_RATE_LIMIT_PER_MINUTE) || 30);
const INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_PER_MINUTE);
const MAX_QUEUE_LENGTH = Math.max(1, Number(process.env.QUEUE_MAX_LENGTH) || 10_000);
const TEMPLATE_RATE_LIMIT_PER_MINUTE = Math.max(1, Number(process.env.TEMPLATE_RATE_LIMIT_PER_MINUTE) || 5);
const TEMPLATE_INTERVAL_MS = Math.ceil(60_000 / TEMPLATE_RATE_LIMIT_PER_MINUTE);
const TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE = Math.max(
  1,
  Number(process.env.TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE) || 15
);
const TEMPLATE_GLOBAL_INTERVAL_MS = Math.ceil(60_000 / TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE);
const JITTER_MIN_MS = Math.max(0, Number(process.env.SEND_JITTER_MIN_MS) || 300);
const JITTER_MAX_MS = Math.max(JITTER_MIN_MS, Number(process.env.SEND_JITTER_MAX_MS) || 1500);
const COOLDOWN_PER_NUMBER_MS = Math.max(0, Number(process.env.SEND_COOLDOWN_PER_NUMBER_MS) || 60_000);
const CIRCUIT_FAILURE_THRESHOLD = Math.max(1, Number(process.env.CIRCUIT_FAILURE_THRESHOLD) || 5);
const CIRCUIT_COOLDOWN_MS = Math.max(1_000, Number(process.env.CIRCUIT_COOLDOWN_MS) || 3 * 60_000);
let tokens = RATE_LIMIT_PER_MINUTE;
let queue = [];
let refillTimer = null;
const templateTokens = new Map();
const templateRefillTimers = new Map();
let templateGlobalTokens = TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE;
let templateGlobalRefillTimer = null;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
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

function recordSendSuccess() {
  consecutiveFailures = 0;
}

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

export function getCircuitBreakerStatus() {
  const open = isCircuitOpen();
  return { open, resumesAt: open ? new Date(circuitOpenUntil).toISOString() : null };
}

function ensureTemplateBucket(templateName) {
  if (!templateTokens.has(templateName)) {
    templateTokens.set(templateName, TEMPLATE_RATE_LIMIT_PER_MINUTE);
  }
  if (!templateRefillTimers.has(templateName)) {
    const timer = setInterval(() => {
      const current = templateTokens.get(templateName) ?? 0;
      templateTokens.set(templateName, Math.min(TEMPLATE_RATE_LIMIT_PER_MINUTE, current + 1));
      drainQueue(); 
    }, TEMPLATE_INTERVAL_MS);
    
    timer.unref?.();
    templateRefillTimers.set(templateName, timer);
  }
}

function ensureTemplateGlobalRefillTimerRunning() {
  if (templateGlobalRefillTimer) return;
  templateGlobalRefillTimer = setInterval(() => {
    templateGlobalTokens = Math.min(TEMPLATE_GLOBAL_RATE_LIMIT_PER_MINUTE, templateGlobalTokens + 1);
    drainQueue(); 
  }, TEMPLATE_GLOBAL_INTERVAL_MS);
  templateGlobalRefillTimer.unref?.();
}

function hasTemplateQuota(templateName) {
  ensureTemplateBucket(templateName);
  ensureTemplateGlobalRefillTimerRunning();
  return (templateTokens.get(templateName) ?? 0) > 0 && templateGlobalTokens > 0;
}

function consumeTemplateQuota(templateName) {
  templateTokens.set(templateName, (templateTokens.get(templateName) ?? 0) - 1);
  templateGlobalTokens -= 1;
}

export function getQueueLength() {
  return queue.length;
}

export function getQueuePosition(id) {
  const index = queue.findIndex((item) => item.id === id);
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
  if (tokens > 0 && !isCircuitOpen() && hasTemplateQuota(template_wa)) {
    tokens -= 1;
    consumeTemplateQuota(template_wa);
    processOne(row.id).catch((error) => {
      console.error(`[queueService] Error tak terduga memproses id=${row.id}:`, error?.message ?? error);
    });
    return { row, position: 0, estimatedWaitSeconds: 0, immediate: true };
  }

  queue.push({ id: row.id, template_wa });
  const position = queue.length;
  return { row, position, estimatedWaitSeconds: estimateWaitSeconds(position), immediate: false };
}

function ensureRefillTimerRunning() {
  if (refillTimer) return; 
  refillTimer = setInterval(() => {
    tokens = Math.min(RATE_LIMIT_PER_MINUTE, tokens + 1);
    drainQueue(); 
  }, INTERVAL_MS);
}

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
      
      
    } else {
      i += 1; 
    }
  }
}

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
  const normalizedNo = normalizePhoneDigits(row.no_wa);
  const lastSentAt = lastSentAtByNumber.get(normalizedNo);
  const cooldownRemaining = lastSentAt
    ? Math.max(0, COOLDOWN_PER_NUMBER_MS - (Date.now() - lastSentAt))
    : 0;
  const extraDelay = cooldownRemaining + randomJitterMs();
  if (extraDelay > 0) {
    await sleep(extraDelay);
  }
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
      console.warn(
        `[queueService] id=${id}: template '${row.template_wa}' butuh balasan Approve/Reject, tapi provider tidak mengembalikan message_id -- balasan user nanti tidak akan bisa dicocokkan.`
      );
    }
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
