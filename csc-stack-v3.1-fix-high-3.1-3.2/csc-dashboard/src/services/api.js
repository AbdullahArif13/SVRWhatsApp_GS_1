import { API_BASE_URL, API_KEY } from "../config.js";

/**
 * Helper terpusat buat semua fetch ke backend, supaya header
 * (Content-Type + X-API-Key) konsisten di semua request tanpa perlu
 * diulang manual di tiap fungsi di bawah.
 */
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (API_KEY) headers["X-API-Key"] = API_KEY;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Request gagal (status ${response.status})`);
  }

  return data;
}

function formatCreatedAt(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    status: row.status,
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    isDeleted: Boolean(row.is_deleted),
    requireReply: Boolean(row.require_reply),
    createdAt: formatCreatedAt(row.created_at),
  };
}

export async function getMessageLogs() {
  const data = await apiFetch("/messages");
  return data?.data ?? [];
}

/**
 * @param {{ templateName: string, noWa: string, namaWa: string, values: Record<string,string> }} params
 */
export async function sendTemplateMessage({ templateName, noWa, namaWa, values }) {
  return apiFetch("/send-message", {
    method: "POST",
    body: JSON.stringify({ template_wa: templateName, no_wa: noWa, nama_wa: namaWa, values }),
  });
}

export async function getTemplates() {
  const data = await apiFetch("/templates");
  return (data?.data ?? []).map(mapTemplate);
}

/**
 * @param {{ name: string, body: string, requireReply?: boolean }} params
 */
export async function createTemplateApi({ name, body, requireReply = false }) {
  const data = await apiFetch("/templates", {
    method: "POST",
    body: JSON.stringify({ name, body, require_reply: Boolean(requireReply) }),
  });
  return mapTemplate(data.data);
}

/**
 * @param {{ name: string, body: string, requireReply?: boolean }} params
 */
export async function updateTemplateApi(id, { name, body, requireReply }) {
  const data = await apiFetch(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, body, require_reply: requireReply }),
  });
  return mapTemplate(data.data);
}

export async function deactivateTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/deactivate`, { method: "PATCH" });
  return mapTemplate(data.data);
}

export async function activateTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/activate`, { method: "PATCH" });
  return mapTemplate(data.data);
}

export async function softDeleteTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/soft-delete`, { method: "PATCH" });
  return mapTemplate(data.data);
}

export async function restoreTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/restore`, { method: "PATCH" });
  return mapTemplate(data.data);
}

export async function deleteTemplateApi(id) {
  return apiFetch(`/templates/${id}`, { method: "DELETE" });
}

function mapContact(row) {
  return {
    id: row.id,
    name: row.nama_wa,
    phone: row.no_wa,
    // "send_message" -> kontak ini kesimpen OTOMATIS dari POST
    // /api/send-message (bukan di-add manual lewat dashboard).
    source: row.source,
    createdAt: formatCreatedAt(row.created_at),
  };
}

export async function getContacts() {
  const data = await apiFetch("/contacts");
  return (data?.data ?? []).map(mapContact);
}

/**
 * @param {{ name: string, phone: string }} params
 */
export async function createContactApi({ name, phone }) {
  const data = await apiFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({ name, phone }),
  });
  return mapContact(data.data);
}
