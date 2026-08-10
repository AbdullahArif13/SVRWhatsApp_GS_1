// Baca daftar SESI LOGIN yang sedang aktif -- langsung dari tabel `session`
// yang dikelola otomatis oleh connect-pg-simple (session store
// express-session, lihat server.js). Dipakai fitur "Sesi Login" di sidebar
// dashboard supaya Admin bisa lihat siapa saja yang sedang login.
//
// Kolom `sess` isinya JSON bebas (apa pun yang ditaruh di req.session) --
// authController.js menaruh `username` dan `loginAt` di situ pas login
// berhasil, jadi kita tinggal baca lagi dari sana, TANPA perlu tabel audit
// terpisah.

import { pool } from "../db.js";

/**
 * Semua sesi yang BELUM kedaluwarsa, terbaru login duluan. `sess.username`
 * bisa null untuk baris session lama/aneh (mis. sempat kebuat sebelum
 * login sukses) -- baris begini sengaja tetap ditampilkan dengan
 * username "(tidak diketahui)" di frontend, bukan disembunyikan, supaya
 * Admin tetap sadar ada sesi aktif yang tidak wajar.
 */
export async function listActiveLoginSessions() {
  const { rows } = await pool.query(
    `SELECT sid, sess, expire FROM session WHERE expire > now() ORDER BY expire DESC`
  );

  return rows.map((row) => ({
    sid: row.sid,
    username: row.sess?.username ?? null,
    loginAt: row.sess?.loginAt ?? null,
    expiresAt: row.expire,
  }));
}

/** Hapus SATU sesi berdasarkan sid -- dipakai kalau Admin mau paksa-logout sesi lain. */
export async function deleteLoginSession(sid) {
  await pool.query("DELETE FROM session WHERE sid = $1", [sid]);
}
