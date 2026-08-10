// Query agregasi untuk Dashboard analitik (v3.11) -- SEMUA query di sini
// READ-ONLY (cuma SELECT/COUNT), aman diakses role mana pun yang sudah
// login (termasuk 'pengguna'/read-only) MAUPUN integrasi eksternal lewat
// X-API-Key langsung (lihat routes/analyticsRoutes.js -- endpoint ini
// SENGAJA tidak dibatasi requireRole, cukup apiKeyAuth yang sudah
// terpasang global di server.js, supaya bisa dikasihkan ke pihak luar
// yang mau bikin tampilan sendiri dari data yang sama).

import { pool } from "../db.js";

const GRANULARITY_TO_TRUNC = { daily: "day", monthly: "month", yearly: "year" };

export function isValidGranularity(value) {
  return Object.prototype.hasOwnProperty.call(GRANULARITY_TO_TRUNC, value);
}

/** Tren jumlah pesan per hari/bulan/tahun, dipecah per status (terkirim/gagal/antri). */
export async function getMessageTrend(granularity = "daily") {
  const truncField = GRANULARITY_TO_TRUNC[granularity] ?? "day";
  const { rows } = await pool.query(
    `SELECT date_trunc($1, created_at) AS bucket, status, COUNT(*)::int AS count
       FROM message_logs
      GROUP BY bucket, status
      ORDER BY bucket ASC`,
    [truncField]
  );

  const buckets = new Map();
  for (const row of rows) {
    const key = row.bucket.toISOString();
    if (!buckets.has(key)) buckets.set(key, { date: key, terkirim: 0, gagal: 0, antri: 0 });
    buckets.get(key)[row.status] = row.count;
  }
  return Array.from(buckets.values());
}

/** Total pengiriman per status, sepanjang masa (dipakai pie chart). */
export async function getStatusBreakdown() {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM message_logs GROUP BY status`
  );
  return rows;
}

/** Jumlah pengiriman per template -- lihat template mana yang paling sering dipakai. */
export async function getTemplateUsage() {
  const { rows } = await pool.query(
    `SELECT template_wa, COUNT(*)::int AS count
       FROM message_logs
      GROUP BY template_wa
      ORDER BY count DESC`
  );
  return rows;
}

/** Pertumbuhan jumlah kontak baru per hari/bulan/tahun. */
export async function getContactGrowth(granularity = "daily") {
  const truncField = GRANULARITY_TO_TRUNC[granularity] ?? "day";
  const { rows } = await pool.query(
    `SELECT date_trunc($1, created_at) AS bucket, COUNT(*)::int AS count
       FROM contacts
      GROUP BY bucket
      ORDER BY bucket ASC`,
    [truncField]
  );
  return rows.map((row) => ({ date: row.bucket.toISOString(), count: row.count }));
}

/** Rasio balasan Approve/Reject/Menunggu/Tidak Diperlukan dari fitur Approve/Reject. */
export async function getReplyRatio() {
  const { rows } = await pool.query(
    `SELECT reply_status, COUNT(*)::int AS count FROM message_logs GROUP BY reply_status`
  );
  return rows;
}
