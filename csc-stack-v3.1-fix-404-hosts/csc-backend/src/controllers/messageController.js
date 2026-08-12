import { findTemplateByName, findAnyTemplateByName } from "../data/templates.js";
import { extractVariableNames, buildFinalMessage, findMissingVariables } from "../utils/templateEngine.js";
import { listMessageLogs, findMessageLogById } from "../data/messageLogs.js";
import { upsertContactFromMessage } from "../data/contacts.js";
import { enqueueMessage, getQueuePosition, estimateWaitSeconds, getCircuitBreakerStatus } from "../services/queueService.js";
import { buildUploadedPhotoUrl } from "../middleware/uploadPhoto.js";
import { logActivity, actorFromRequest } from "../data/activityLogs.js";

const TOP_LEVEL_FIELDS = new Set(["template_wa", "no_wa", "nama_wa"]);
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const GROUP_JID_PATTERN = /^[0-9]+(-[0-9]+)?@g\.us$/;
const MAX_VALUES_KEYS = 30;
const MAX_VALUE_LENGTH = 2000;
const IMAGE_URL_KEY = "foto";

function findValueCaseInsensitive(values, key) {
  if (!values || typeof values !== "object") return undefined;
  const entry = Object.entries(values).find(([k]) => k.toLowerCase() === key);
  return entry ? entry[1] : undefined;
}

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

  
  
  const fotoValue = findValueCaseInsensitive(values, IMAGE_URL_KEY);
  if (fotoValue !== undefined && String(fotoValue).trim() !== "" && !isHttpUrl(fotoValue)) {
    return "Field 'values.foto' harus berupa URL gambar yang valid (diawali http:// atau https://), bukan base64/path lokal.";
  }

  return null;
}

export async function handleSendMessage(req, res) {
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

  if (!template_wa || typeof template_wa !== "string") {
    return res.status(400).json({ success: false, message: "Field 'template_wa' wajib diisi." });
  }
  if (!no_wa || typeof no_wa !== "string") {
    return res.status(400).json({ success: false, message: "Field 'no_wa' wajib diisi." });
  }
  
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

  if (!isGroupTarget) {
    try {
      await upsertContactFromMessage({ no_wa: cleanedNoWa, nama_wa });
    } catch (error) {
      console.error("[handleSendMessage] Gagal simpan kontak otomatis:", error?.message ?? error);
    }
  }

  const template = await findTemplateByName(template_wa);
  if (!template) {
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

  const missing = findMissingVariables(template.body, values ?? {});
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Variabel berikut belum diisi: ${missing.join(", ")}`,
      required_variables: extractVariableNames(template.body),
      missing_variables: missing,
    });
  }

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

  const finalMessage = buildFinalMessage(template.body, effectiveValues, template.require_reply);

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
      status: row.status, 
      queue_position: position,
      estimated_wait_seconds: estimatedWaitSeconds,
      template_used: template.name,
      require_reply: template.require_reply,
      use_photo: template.use_photo,
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


export async function handleListMessages(_req, res) {
  return res.status(200).json({
    success: true,
    data: await listMessageLogs(),
  });
}


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
