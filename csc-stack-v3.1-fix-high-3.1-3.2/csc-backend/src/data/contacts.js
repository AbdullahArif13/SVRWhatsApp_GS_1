// Sumber data kontak — tabel `contacts` di PostgreSQL (lihat db/schema.sql).
//
// Diisi lewat 2 jalur (lihat masing-masing fungsi export di bawah):
//   1. upsertContactFromMessage()  -> dipanggil OTOMATIS oleh
//      handleSendMessage di messageController.js, dari field
//      `no_wa` + `nama_wa` yang sudah wajib ada di tiap POST
//      /api/send-message. Jadi tiap kali sistem lain (mis. Web E-Picking)
//      kirim WA lewat backend ini, kontak tujuannya otomatis kesimpen --
//      tidak perlu di-add manual lagi di dashboard.
//   2. createContactManual()       -> dipanggil dari form "Add Contact"
//      di dashboard (POST /api/contacts), buat kontak yang belum pernah
//      dipakai kirim pesan tapi mau disiapkan duluan.

import { pool } from "../db.js";
import { normalizePhoneDigits } from "../services/waService.js";

/** Semua kontak, terbaru duluan. Dipakai GET /api/contacts. */
export async function listContacts() {
  const { rows } = await pool.query(
    "SELECT id, no_wa, nama_wa, source, created_at, updated_at FROM contacts ORDER BY created_at DESC"
  );
  return rows;
}

/** Cari kontak berdasarkan no_wa (sudah ternormalisasi). */
export async function findContactByPhone(noWa) {
  const normalized = normalizePhoneDigits(noWa);
  if (!normalized) return null;
  const { rows } = await pool.query(
    "SELECT id, no_wa, nama_wa, source, created_at, updated_at FROM contacts WHERE no_wa = $1 LIMIT 1",
    [normalized]
  );
  return rows[0] ?? null;
}

/**
 * Dipanggil tiap ada request masuk ke POST /api/send-message. Simpan/
 * update kontak berdasarkan `no_wa` + `nama_wa` yang dikirim di body.
 *
 * - Kalau nomornya belum ada -> insert baru, source = 'send_message'.
 * - Kalau nomornya SUDAH ada (baik dari send_message sebelumnya maupun
 *   dari Add Contact manual) -> nama_wa di-update ke nilai TERBARU yang
 *   dikirim, tapi kolom `source` dibiarkan seperti semula (tidak
 *   menimpa status "manual" jadi "send_message").
 *
 * Sengaja dibuat "best effort": kalau query ini gagal (mis. DB lagi
 * bermasalah), lempar error ke pemanggil supaya pemanggil (messageController)
 * yang memutuskan apakah itu boleh mengganggu proses kirim pesan atau tidak
 * -- tidak diam-diam ditelan di sini.
 */
export async function upsertContactFromMessage({ no_wa, nama_wa }) {
  const normalized = normalizePhoneDigits(no_wa);
  const name = String(nama_wa ?? "").trim();
  if (!normalized || !name) return null;

  await pool.query(
    `INSERT INTO contacts (no_wa, nama_wa, source)
     VALUES ($1, $2, 'send_message')
     ON CONFLICT (no_wa) DO UPDATE SET nama_wa = EXCLUDED.nama_wa, updated_at = now()`,
    [normalized, name]
  );

  return findContactByPhone(normalized);
}

/**
 * Dipanggil dari form "Add Contact" di dashboard (POST /api/contacts).
 * Beda dengan upsertContactFromMessage: fungsi ini menolak (lempar error
 * bertipe DUPLICATE_CONTACT) kalau nomornya sudah pernah tersimpan --
 * supaya user yang add manual dikasih tahu jelas alih-alih diam-diam
 * menimpa nama kontak yang sudah ada.
 */
export async function createContactManual({ no_wa, nama_wa }) {
  const normalized = normalizePhoneDigits(no_wa);
  const name = String(nama_wa ?? "").trim();

  const existing = await findContactByPhone(normalized);
  if (existing) {
    const error = new Error(`Nomor ${normalized} sudah terdaftar sebagai kontak "${existing.nama_wa}".`);
    error.code = "DUPLICATE_CONTACT";
    throw error;
  }

  const { rows } = await pool.query(
    "INSERT INTO contacts (no_wa, nama_wa, source) VALUES ($1, $2, 'manual') RETURNING id",
    [normalized, name]
  );

  const { rows: found } = await pool.query(
    "SELECT id, no_wa, nama_wa, source, created_at, updated_at FROM contacts WHERE id = $1 LIMIT 1",
    [rows[0].id]
  );
  return found[0] ?? null;
}
