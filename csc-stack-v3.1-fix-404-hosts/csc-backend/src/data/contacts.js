import { pool } from "../db.js";
import { normalizePhoneDigits } from "../services/waService.js";

export async function listContacts() {
  const { rows } = await pool.query(
    "SELECT id, no_wa, nama_wa, source, created_at, updated_at FROM contacts ORDER BY created_at DESC"
  );
  return rows;
}

export async function findContactByPhone(noWa) {
  const normalized = normalizePhoneDigits(noWa);
  if (!normalized) return null;
  const { rows } = await pool.query(
    "SELECT id, no_wa, nama_wa, source, created_at, updated_at FROM contacts WHERE no_wa = $1 LIMIT 1",
    [normalized]
  );
  return rows[0] ?? null;
}

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
