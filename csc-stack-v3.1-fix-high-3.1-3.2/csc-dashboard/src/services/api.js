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

/**
 * Format timestamp dari database (mis. "2026-07-08T02:10:00.000Z") jadi
 * string yang sama gayanya dengan yang tadinya di-generate langsung di
 * TemplatesContext.jsx, supaya Templates.jsx / CreateTemplate.jsx (yang
 * baca `template.createdAt`) tidak perlu diubah sama sekali.
 */
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
    // Soft-delete flag (v3): false berarti template sudah "dihapus" lewat
    // icon trash di tabel, tapi baris-nya masih ada -- bisa di-restore atau
    // dihapus permanen lewat popup detail.
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    // v3.3: flag TERPISAH dari isActive -- true berarti template sudah
    // "dihapus" (icon trash) dan masuk panel Database, terlepas dari
    // status Aktif/Nonaktif-nya.
    isDeleted: Boolean(row.is_deleted),
    // v3.2: parameter True/False fitur Approve/Reject dari halaman Create
    // Template -- true berarti penerima WAJIB membalas "Approve"/"Reject".
    requireReply: Boolean(row.require_reply),
    createdAt: formatCreatedAt(row.created_at),
  };
}

/**
 * Mengambil riwayat pengiriman (dikirim OLEH sistem permintaan lewat
 * backend, BUKAN oleh FrontEnd ini). FrontEnd hanya menampilkan, tidak
 * pernah memicu pengiriman.
 */
export async function getMessageLogs() {
  const data = await apiFetch("/messages");
  return data?.data ?? [];
}

/**
 * Mengirim pesan berbasis template ke backend.
 *
 * PENTING: yang dikirim ke backend HANYA:
 *  - template_wa : nama/key template saja (mis. "Shortage_epicking"),
 *                  BUKAN isi body/kalimat panjangnya. Body lengkap sudah
 *                  tersimpan di sisi backend/database, jadi tidak perlu
 *                  dikirim ulang dari frontend (menghindari redundansi).
 *  - no_wa       : nomor tujuan.
 *  - values      : object dinamis berisi isi tiap {{variabel}} yang
 *                  dibutuhkan template tersebut.
 *
 * @param {{ templateName: string, noWa: string, namaWa: string, values: Record<string,string> }} params
 */
export async function sendTemplateMessage({ templateName, noWa, namaWa, values }) {
  return apiFetch("/send-message", {
    method: "POST",
    body: JSON.stringify({ template_wa: templateName, no_wa: noWa, nama_wa: namaWa, values }),
  });
}

/**
 * Ambil semua template dari database (lewat backend), dipakai
 * TemplatesContext.jsx supaya daftar template TIDAK hilang tiap refresh
 * halaman lagi.
 */
export async function getTemplates() {
  const data = await apiFetch("/templates");
  return (data?.data ?? []).map(mapTemplate);
}

/**
 * Simpan template baru ke database (lewat backend), dipanggil dari
 * halaman Create Template.
 *
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
 * Edit nama/isi template yang sudah ada -- dipanggil dari icon "Edit"
 * (folder) di popup detail template.
 *
 * @param {{ name: string, body: string, requireReply?: boolean }} params
 */
export async function updateTemplateApi(id, { name, body, requireReply }) {
  const data = await apiFetch(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, body, require_reply: requireReply }),
  });
  return mapTemplate(data.data);
}

/**
 * Toggle status Aktif -> Nonaktif lewat SWITCH di TABEL Templates.
 * Baris TETAP tampil di tabel utama, TIDAK pindah kemana-mana.
 */
export async function deactivateTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/deactivate`, { method: "PATCH" });
  return mapTemplate(data.data);
}

/**
 * Toggle status Nonaktif -> Aktif lewat SWITCH di TABEL Templates.
 */
export async function activateTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/activate`, { method: "PATCH" });
  return mapTemplate(data.data);
}

/**
 * "Hapus" (icon tong sampah, di tabel maupun popup detail) -- pindahkan
 * template ke panel "Database". Baris TIDAK dihapus dari database.
 */
export async function softDeleteTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/soft-delete`, { method: "PATCH" });
  return mapTemplate(data.data);
}

/**
 * Tombol "Gunakan Kembali" di panel Database -- kembalikan template ke
 * tabel utama lagi.
 */
export async function restoreTemplateApi(id) {
  const data = await apiFetch(`/templates/${id}/restore`, { method: "PATCH" });
  return mapTemplate(data.data);
}

/**
 * Hapus permanen dari database. TIDAK dipakai/dipicu dari UI manapun saat
 * ini (disimpan untuk kebutuhan lain di masa depan).
 */
export async function deleteTemplateApi(id) {
  return apiFetch(`/templates/${id}`, { method: "DELETE" });
}

/**
 * Ubah baris kontak dari database jadi bentuk yang dipakai
 * ContactsContext.jsx / AddContact.jsx (name, phone, createdAt, source),
 * sama gayanya dengan mapTemplate() di atas.
 */
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

/**
 * Ambil semua kontak dari database (lewat backend) -- gabungan yang
 * otomatis kesimpen dari /api/send-message (field no_wa + nama_wa) dan
 * yang di-add manual lewat form "Add Contact".
 */
export async function getContacts() {
  const data = await apiFetch("/contacts");
  return (data?.data ?? []).map(mapContact);
}

/**
 * Simpan kontak baru SECARA MANUAL ke database, dipanggil dari form
 * "Add Contact" di dashboard. Backend akan menolak (409) kalau nomornya
 * sudah pernah tersimpan sebelumnya (baik dari sini maupun otomatis dari
 * send-message).
 *
 * @param {{ name: string, phone: string }} params
 */
export async function createContactApi({ name, phone }) {
  const data = await apiFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({ name, phone }),
  });
  return mapContact(data.data);
}
