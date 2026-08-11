// Query agregasi untuk Dashboard analitik (v3.11) -- SEMUA query di sini
// READ-ONLY (cuma SELECT/COUNT), aman diakses role mana pun yang sudah
// login (termasuk 'pengguna'/read-only) MAUPUN integrasi eksternal lewat
// X-API-Key langsung (lihat routes/analyticsRoutes.js -- endpoint ini
// SENGAJA tidak dibatasi requireRole, cukup apiKeyAuth yang sudah
// terpasang global di server.js, supaya bisa dikasihkan ke pihak luar
// yang mau bikin tampilan sendiri dari data yang sama).

import { pool } from "../db.js";

const VALID_GRANULARITIES = new Set(["daily", "monthly", "yearly"]);

export function isValidGranularity(value) {
  return VALID_GRANULARITIES.has(value);
}

/**
 * v3.13: Setiap granularity punya "skop waktu" yang jelas & bucket SQL
 * sendiri -- soalnya masing-masing scope-nya beda:
 *   - daily   : SATU hari yang dipilih user (`day`, format "YYYY-MM-DD",
 *               default hari ini). SENGAJA dikunci hanya boleh tanggal di
 *               BULAN & TAHUN BERJALAN -- kalau `day` yang dikirim FE
 *               ternyata beda bulan/tahun, diabaikan & fallback ke hari
 *               ini (jangan sampai nyebrang bulan/tahun lain). Dipecah per
 *               30 menit (00.00 -> 23.30, 48 titik).
 *   - monthly : 1 bulan yang dipilih user (dropdown Januari-Desember,
 *               tahun berjalan), dipecah per HARI dalam bulan itu.
 *   - yearly  : 1 tahun yang dipilih user (dropdown tahun), dipecah per
 *               BULAN dalam tahun itu.
 *
 * `range()` menghitung batas waktu [start, end) dan daftar bucket kosong
 * (supaya sumbu-X grafik tetap lengkap walau belum ada data di bucket itu --
 * misal jam 3 pagi belum ada pesan, tetap muncul titik 0 di grafik).
 *
 * Dipakai juga oleh chart yang GAK di-bucket per waktu (Status Pengiriman,
 * Rasio Balasan, Pemakaian per Template) -- buat chart-chart itu cuma
 * start/end yang dipakai (buckets-nya diabaikan), supaya semuanya ikut
 * menyesuaikan skop harian/bulanan/tahunan yang sama.
 */
function range(granularity, { day, month, year } = {}) {
  const now = new Date();

  if (granularity === "daily") {
    let target = now;
    if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const [yy, mm, dd] = day.split("-").map(Number);
      const candidate = new Date(Date.UTC(yy, mm - 1, dd));
      // Kunci: tanggal yang dipilih HARUS di bulan & tahun berjalan --
      // kalau tidak, abaikan & tetap pakai hari ini.
      if (candidate.getUTCFullYear() === now.getUTCFullYear() && candidate.getUTCMonth() === now.getUTCMonth()) {
        target = candidate;
      }
    }
    const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const buckets = [];
    for (let i = 0; i < 48; i++) buckets.push(new Date(start.getTime() + i * 30 * 60 * 1000).toISOString());
    return { start, end, buckets, truncUnit: "hour" };
  }

  if (granularity === "monthly") {
    const y = Number.isInteger(year) ? year : now.getUTCFullYear();
    const m = Number.isInteger(month) ? month - 1 : now.getUTCMonth(); // month: 1-12 dari FE
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 1));
    const daysInMonth = Math.round((end - start) / (24 * 60 * 60 * 1000));
    const buckets = [];
    for (let i = 0; i < daysInMonth; i++) buckets.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString());
    return { start, end, buckets, truncUnit: "day" };
  }

  // yearly
  const y = Number.isInteger(year) ? year : now.getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const end = new Date(Date.UTC(y + 1, 0, 1));
  const buckets = [];
  for (let i = 0; i < 12; i++) buckets.push(new Date(Date.UTC(y, i, 1)).toISOString());
  return { start, end, buckets, truncUnit: "month" };
}

/** Isi ulang bucket kosong (count 0) supaya sumbu-X grafik selalu lengkap. */
function fillEmptyBuckets(rowsByBucket, buckets, shape) {
  return buckets.map((key) => rowsByBucket.get(key) ?? { date: key, ...shape });
}

/** Ekspresi SQL untuk bucket waktu. 'daily' dipecah manual per 30 menit
 *  karena Postgres date_trunc() tidak punya opsi bawaan "30 minute". */
function bucketExpr(granularity) {
  if (granularity === "daily") {
    return `date_trunc('hour', created_at) + INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM created_at) / 30)`;
  }
  if (granularity === "monthly") return `date_trunc('day', created_at)`;
  return `date_trunc('month', created_at)`; // yearly
}

/** Tren jumlah pesan per 30menit/hari/bulan (tergantung granularity), dipecah per status. */
export async function getMessageTrend(granularity = "daily", options = {}) {
  const { start, end, buckets } = range(granularity, options);
  const { rows } = await pool.query(
    `SELECT ${bucketExpr(granularity)} AS bucket, status, COUNT(*)::int AS count
       FROM message_logs
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY bucket, status
      ORDER BY bucket ASC`,
    [start, end]
  );

  const byBucket = new Map();
  for (const row of rows) {
    const key = row.bucket.toISOString();
    if (!byBucket.has(key)) byBucket.set(key, { date: key, terkirim: 0, gagal: 0, antri: 0 });
    byBucket.get(key)[row.status] = row.count;
  }
  return fillEmptyBuckets(byBucket, buckets, { terkirim: 0, gagal: 0, antri: 0 });
}

/** Total pengiriman per status (pie "Status Pengiriman") -- diskop ke
 *  harian(hari pilihan)/bulanan(bulan pilihan)/tahunan(tahun pilihan),
 *  sama seperti grafik tren di atas. */
export async function getStatusBreakdown(granularity = "daily", options = {}) {
  const { start, end } = range(granularity, options);
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count
       FROM message_logs
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY status`,
    [start, end]
  );
  return rows;
}

/** Jumlah pengiriman per template (bar "Pemakaian per Template") -- diskop
 *  ke harian/bulanan/tahunan juga, biar kelihatan template mana yang paling
 *  sering dipakai DI PERIODE yang lagi dilihat, bukan cuma sepanjang masa. */
export async function getTemplateUsage(granularity = "daily", options = {}) {
  const { start, end } = range(granularity, options);
  const { rows } = await pool.query(
    `SELECT template_wa, COUNT(*)::int AS count
       FROM message_logs
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY template_wa
      ORDER BY count DESC`,
    [start, end]
  );
  return rows;
}

/** Pertumbuhan jumlah kontak baru per 30menit/hari/bulan (tergantung granularity). */
export async function getContactGrowth(granularity = "daily", options = {}) {
  const { start, end, buckets } = range(granularity, options);
  const { rows } = await pool.query(
    `SELECT ${bucketExpr(granularity)} AS bucket, COUNT(*)::int AS count
       FROM contacts
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY bucket
      ORDER BY bucket ASC`,
    [start, end]
  );

  const byBucket = new Map();
  for (const row of rows) byBucket.set(row.bucket.toISOString(), { date: row.bucket.toISOString(), count: row.count });
  return fillEmptyBuckets(byBucket, buckets, { count: 0 });
}

/** Rasio balasan Approve/Reject/Menunggu/Tidak Diperlukan dari fitur
 *  Approve/Reject -- diskop ke harian/bulanan/tahunan juga (berdasarkan
 *  kapan pesannya DIKIRIM, konsisten dengan chart lain di atas). */
export async function getReplyRatio(granularity = "daily", options = {}) {
  const { start, end } = range(granularity, options);
  const { rows } = await pool.query(
    `SELECT reply_status, COUNT(*)::int AS count
       FROM message_logs
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY reply_status`,
    [start, end]
  );
  return rows;
}