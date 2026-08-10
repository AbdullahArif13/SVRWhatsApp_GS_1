// Sumber data akun login dashboard -- tabel `users` di PostgreSQL (lihat
// db/schema.sql). v3.11: bukan cuma Admin lagi -- ada 3 role:
//   - super_admin : otorisasi penuh (termasuk paksa-logout sesi lain,
//                   bisa bikin akun role apa pun).
//   - admin       : semua fitur SAMA seperti super_admin KECUALI tidak
//                   bisa paksa-logout sesi lain. Bisa bikin akun role
//                   'pengguna' (TIDAK bisa bikin 'admin'/'super_admin').
//   - pengguna    : read-only, cuma bisa lihat halaman Dashboard analitik.
//
// password_hash SELALU bcrypt -- tidak ada satu baris kode pun di sini
// yang menerima/menyimpan password mentah (lihat authController.js untuk
// verifikasi login, dan usersController.js untuk bikin akun baru).

import { pool } from "../db.js";

const PUBLIC_COLUMNS = "id, username, role, created_by, created_at";

/** Cari user berdasarkan username (case-sensitive, sesuai kolom UNIQUE-nya). */
export async function findUserByUsername(username) {
  const { rows } = await pool.query(
    `SELECT id, username, password_hash, role, created_by, created_at FROM users WHERE username = $1 LIMIT 1`,
    [username]
  );
  return rows[0] ?? null;
}

/** Cari user berdasarkan id (TANPA password_hash -- dipakai buat ditampilkan ke FrontEnd). */
export async function findUserById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

/**
 * Daftar user dengan pagination -- dipakai popup "Manage User". Terbaru
 * duluan. `page` 1-based, `pageSize` dibatasi wajar (lihat usersController.js).
 */
export async function listUsersPaginated({ page = 1, pageSize = 10 }) {
  const offset = (page - 1) * pageSize;

  const [{ rows: totalRows }, { rows }] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM users"),
    pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
  ]);

  return { data: rows, total: totalRows[0].total, page, pageSize };
}

/**
 * Bikin akun baru -- dipanggil dari popup "Manage User". Validasi SIAPA
 * boleh bikin role APA dilakukan di usersController.js (data layer ini
 * murni insert, tidak tahu soal otorisasi).
 */
export async function createUser({ username, passwordHash, role, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, role, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [username, passwordHash, role, createdBy ?? null]
  );
  return rows[0];
}
