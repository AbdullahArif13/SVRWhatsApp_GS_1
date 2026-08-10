// Sumber data template — SEKARANG baca/tulis ke tabel `templates` di
// PostgreSQL (jalan di Docker, lihat docker-compose.yml), bukan array
// hardcode lagi.
//
// Setiap template punya `body` bebas berisi placeholder {{apa_saja}} —
// jumlah dan nama placeholder TIDAK dibatasi/di-hardcode di sini, sama
// seperti sebelumnya.

import { pool } from "../db.js";

/**
 * Semua template, terbaru duluan. Dipakai untuk halaman "Templates" di
 * FrontEnd dan endpoint GET /api/templates.
 */
export async function listTemplates() {
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, use_photo, created_at FROM templates ORDER BY created_at DESC"
  );
  return rows;
}

/**
 * Cari template berdasarkan nama (case-insensitive), dipakai untuk
 * mencocokkan field `template_wa` yang dikirim dari frontend/sistem lain.
 *
 * PENTING: fungsi ini sekarang ASYNC (query ke database), jadi tempat yang
 * memanggilnya wajib pakai `await findTemplateByName(...)`.
 *
 * Template yang sudah di-non-aktifkan (is_active = false) ATAU sudah
 * "dihapus"/masuk panel Database (is_deleted = true) SENGAJA tidak ikut
 * dicari di sini, supaya sistem permintaan (mis. Web E-Picking) tidak bisa
 * lagi memakai template semacam itu, walau baris-nya belum benar-benar
 * hilang dari database.
 */
export async function findTemplateByName(name) {
  if (!name) return null;
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, use_photo, created_at FROM templates WHERE LOWER(name) = LOWER($1) AND is_active = true AND is_deleted = false LIMIT 1",
    [String(name).trim()]
  );
  return rows[0] ?? null;
}

/** Cari template berdasarkan id (dipakai untuk edit/aktifkan/nonaktifkan/hapus). */
export async function findTemplateById(id) {
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, use_photo, created_at FROM templates WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Cari template berdasarkan nama tapi TANPA filter is_active -- dipakai
 * saat validasi "nama sudah dipakai" pas create/edit, supaya nama yang
 * sudah dipakai template yang sedang non-aktif pun tetap ke-detect (nama
 * tetap UNIQUE di kolom database walau template-nya non-aktif).
 */
export async function findAnyTemplateByName(name) {
  if (!name) return null;
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, use_photo, created_at FROM templates WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [String(name).trim()]
  );
  return rows[0] ?? null;
}

/**
 * Buat template baru. Dipakai oleh endpoint POST /api/templates, yang
 * dipanggil dari halaman "Create Template" di FrontEnd.
 */
export async function createTemplate({ name, body, status = "Approve", requireReply = false, usePhoto = false }) {
  const { rows } = await pool.query(
    "INSERT INTO templates (name, body, status, require_reply, use_photo) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [name, body, status, Boolean(requireReply), Boolean(usePhoto)]
  );
  return findTemplateById(rows[0].id);
}

/**
 * Edit nama/isi template yang sudah ada. Dipakai oleh tombol "Edit" (icon
 * folder) di halaman Templates -- popup dashboard_popup_tamplate.
 */
export async function updateTemplate(id, { name, body, requireReply, usePhoto }) {
  // requireReply & usePhoto bersifat opsional di sini -- kalau tidak
  // dikirim (undefined), nilai lama di database TIDAK diubah (dipertahankan
  // lewat COALESCE), supaya endpoint ini tetap kompatibel dipanggil hanya
  // dengan name+body.
  await pool.query(
    `UPDATE templates
       SET name = $1, body = $2,
           require_reply = COALESCE($3, require_reply),
           use_photo = COALESCE($4, use_photo)
     WHERE id = $5`,
    [
      name,
      body,
      requireReply === undefined ? null : Boolean(requireReply),
      usePhoto === undefined ? null : Boolean(usePhoto),
      id,
    ]
  );
  return findTemplateById(id);
}

/**
 * Ganti status Aktif/Nonaktif template lewat toggle di TABEL Templates.
 * Ini toggle RINGAN -- baris TETAP tampil di tabel utama baik Aktif
 * maupun Nonaktif, TIDAK pindah kemana-mana. Beda dengan
 * setTemplateDeleted di bawah, yang benar-benar memindahkan template ke
 * panel "Database" (hilang dari tabel utama).
 */
export async function setTemplateActive(id, isActive) {
  await pool.query("UPDATE templates SET is_active = $1 WHERE id = $2", [Boolean(isActive), id]);
  return findTemplateById(id);
}

/**
 * "Hapus" (icon tong sampah) -- SOFT DELETE. Baris TIDAK dihapus dari
 * database, cuma is_deleted jadi true, jadi template ini otomatis hilang
 * dari tabel utama & picker Chat / tidak bisa dipakai template_wa via
 * /api/send-message, dan cuma bisa dilihat/dipulihkan lagi lewat panel
 * "Database" (isDeleted = false lagi).
 */
export async function setTemplateDeleted(id, isDeleted) {
  await pool.query("UPDATE templates SET is_deleted = $1 WHERE id = $2", [Boolean(isDeleted), id]);
  return findTemplateById(id);
}

/**
 * Hapus permanen. HANYA dipanggil dari tombol "Delete" di dalam popup
 * detail template (dashboard_popup_tamplate) -- bukan dari tombol trash
 * di tabel list, yang cuma soft-delete (lihat setTemplateDeleted di atas).
 */
export async function deleteTemplateForever(id) {
  const result = await pool.query("DELETE FROM templates WHERE id = $1", [id]);
  return result.rowCount > 0;
}
