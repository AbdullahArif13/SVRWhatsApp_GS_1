// Audit trail generik lintas-entitas (Template, Kontak, Kirim Pesan,
// User, Sesi) -- tabel `activity_logs` di PostgreSQL (lihat db/schema.sql).
//
// SATU tabel untuk semua entitas SENGAJA dipilih (bukan kolom
// created_by/updated_by terpisah di tiap tabel) supaya "klik nama user di
// popup Manage User -> lihat semua yang pernah dia lakukan" cukup query 1
// tabel ini, tanpa perlu gabungkan/UNION banyak tabel riwayat yang beda
// bentuk kolomnya.

import { pool } from "../db.js";

/**
 * Catat satu aktivitas. Dipanggil dari controller SETELAH aksi yang
 * sebenarnya (create/update/delete/dst) BERHASIL -- kalau gagal insert
 * log ini, JANGAN sampai menggagalkan aksi utamanya, cukup dicatat warning
 * di console (sama pola dengan upsertContactFromMessage di
 * messageController.js) -- audit trail penting, tapi bukan boleh sampai
 * bikin fitur inti berhenti berfungsi kalau logging-nya sendiri error.
 *
 * `actor` : { userId, username, type } -- `type` "user" kalau dipicu
 *   Admin/Super Admin/Pengguna yang sedang login (ada req.session), atau
 *   "system" kalau dipicu integrasi eksternal murni lewat X-API-Key
 *   TANPA sesi login (mis. POST /send-message dari Web E-Picking) --
 *   untuk kasus "system", `userId` selalu null, `username` diisi label
 *   apa adanya (mis. "system_api_key"/"backend_api_key", lihat
 *   req.apiClient di apiKeyAuth.js).
 */
/**
 * Bentuk objek `actor` yang konsisten dari `req`, dipakai semua controller
 * yang butuh mencatat activity log -- SATU logic terpusat supaya tidak
 * ada controller yang lupa/beda cara nentuin actor:
 *   - Ada sesi login (req.session.adminId) -> actor = user yang login itu.
 *   - TIDAK ada sesi (dipanggil integrasi eksternal murni lewat
 *     X-API-Key, mis. POST /send-message dari Web E-Picking) -> actor
 *     "system", username diisi label key yang dipakai (lihat req.apiClient
 *     di middleware/apiKeyAuth.js: "dashboard" utk BACKEND_API_KEY,
 *     "system" utk SYSTEM_API_KEY).
 */
export function actorFromRequest(req) {
  if (req.session?.adminId) {
    return { userId: req.session.adminId, username: req.session.username, type: "user" };
  }
  return {
    userId: null,
    username: req.apiClient === "system" ? "system_api_key" : "backend_api_key",
    type: "system",
  };
}

export async function logActivity({ actor, action, entityType, entityId = null, detail = null }) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_user_id, actor_username, actor_type, action, entity_type, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actor?.userId ?? null,
        actor?.username ?? null,
        actor?.type ?? "system",
        action,
        entityType,
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        detail ? JSON.stringify(detail) : null,
      ]
    );
  } catch (error) {
    console.error("[activityLogs] Gagal mencatat aktivitas:", error?.message ?? error);
  }
}

/**
 * Riwayat aktivitas SATU user (berdasarkan actor_user_id), dengan
 * pagination -- dipakai popup "Aktivitas User" (klik nama di Manage User).
 */
export async function listActivityLogsByUser(userId, { page = 1, pageSize = 10 }) {
  const offset = (page - 1) * pageSize;

  const [{ rows: totalRows }, { rows }] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM activity_logs WHERE actor_user_id = $1", [userId]),
    pool.query(
      `SELECT id, actor_username, actor_type, action, entity_type, entity_id, detail, created_at
         FROM activity_logs
        WHERE actor_user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    ),
  ]);

  return { data: rows, total: totalRows[0].total, page, pageSize };
}
