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

  // v3.10: WAJIB "include" supaya cookie sesi login (lihat AuthContext.jsx)
  // ikut terkirim -- backend jalan di origin/port BEDA dari dashboard ini
  // (lihat catatan CORS_ORIGIN di server.js), jadi tanpa ini cookie-nya
  // tidak pernah ikut ke request cross-origin.
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
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
    // v3.7: parameter True/False "Aktifkan Penggunaan Foto" dari halaman
    // Create Template -- true berarti template ini WAJIB diisi
    // `values.foto` (URL gambar) tiap kali dipakai lewat /api/send-message.
    usePhoto: Boolean(row.use_photo),
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
 * @param {{ name: string, body: string, requireReply?: boolean, usePhoto?: boolean }} params
 */
export async function createTemplateApi({ name, body, requireReply = false, usePhoto = false }) {
  const data = await apiFetch("/templates", {
    method: "POST",
    body: JSON.stringify({ name, body, require_reply: Boolean(requireReply), use_photo: Boolean(usePhoto) }),
  });
  return mapTemplate(data.data);
}

/**
 * Edit nama/isi template yang sudah ada -- dipanggil dari icon "Edit"
 * (folder) di popup detail template.
 *
 * @param {{ name: string, body: string, requireReply?: boolean, usePhoto?: boolean }} params
 */
export async function updateTemplateApi(id, { name, body, requireReply, usePhoto }) {
  const data = await apiFetch(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, body, require_reply: requireReply, use_photo: usePhoto }),
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

/**
 * v3.10: login dashboard (Admin, username+password).
 *
 * Dipanggil dari Login.jsx. Backend selalu balas 401 dengan pesan yang
 * SAMA persis baik username tidak ada maupun password salah ("Username
 * atau password salah") -- sengaja tidak dibedakan supaya tidak bisa
 * dipakai menebak username yang valid.
 */
export async function loginApi({ username, password }) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

/** Hapus sesi login saat ini (browser ini). */
export async function logoutApi() {
  return apiFetch("/auth/logout", { method: "POST" });
}

/**
 * Cek apakah browser ini masih punya sesi login yang valid -- dipanggil
 * AuthContext.jsx sekali di awal (saat dashboard dibuka/di-refresh).
 * SELALU balas 200 (loggedIn: true/false), tidak pernah melempar error
 * cuma karena belum login.
 */
export async function getMeApi() {
  return apiFetch("/auth/me");
}

/**
 * "Sesi Login" di sidebar -- daftar semua sesi yang sedang aktif (belum
 * kedaluwarsa), supaya Admin tahu siapa saja yang sedang login.
 */
export async function getActiveSessionsApi() {
  const data = await apiFetch("/auth/sessions");
  return data?.data ?? [];
}

/** Paksa-logout SATU sesi lain (bukan sesi sendiri -- pakai logoutApi() untuk itu). */
export async function deleteSessionApi(sid) {
  return apiFetch(`/auth/sessions/${encodeURIComponent(sid)}`, { method: "DELETE" });
}

/**
 * v3.11: "Manage User" -- daftar semua akun dashboard (Super Admin & Admin
 * saja yang bisa panggil ini, lihat requireRole di userRoutes.js).
 * `pageSize` besar SENGAJA dipakai (bukan pagination server yang "beneran"
 * dipakai penuh) -- jumlah user dashboard realistis kecil, jadi ambil
 * sekaligus lalu pagination-nya dilakukan di FrontEnd pakai
 * hooks/usePagination.js yang SAMA dengan Templates/Kontak/Riwayat, biar
 * konsisten satu pola pagination di semua halaman.
 */
export async function getUsersApi() {
  const data = await apiFetch("/users?pageSize=100");
  return data?.data ?? [];
}

/**
 * Bikin akun baru dari popup Manage User.
 * @param {{ username: string, password: string, role: "super_admin"|"admin"|"pengguna" }} params
 */
export async function createUserApi({ username, password, role }) {
  const data = await apiFetch("/users", {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  });
  return data.data;
}

/**
 * Riwayat aktivitas SATU user (klik nama di popup Manage User) -- sama
 * seperti getUsersApi(), ambil sekaligus lalu pagination di FrontEnd.
 */
export async function getUserActivityApi(userId) {
  const data = await apiFetch(`/users/${userId}/activity?pageSize=200`);
  return { user: data.user, activities: data.data ?? [] };
}

/**
 * Dashboard analitik interaktif (v3.11) -- 5 dataset grafik sekaligus.
 * `granularity`: "daily" | "monthly" | "yearly".
 */
export async function getAnalyticsOverviewApi(granularity = "daily") {
  const data = await apiFetch(`/analytics/overview?granularity=${encodeURIComponent(granularity)}`);
  return data?.data ?? null;
}
