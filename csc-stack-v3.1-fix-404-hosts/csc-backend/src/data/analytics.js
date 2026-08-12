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

// v3.14: FIX -- semua bucket/rentang tanggal di bawah sebelumnya dihitung
// pakai field UTC (Date.UTC, getUTCFullYear, dst), sedangkan Postgres
// (SHOW TimeZone -> 'UTC') dan seluruh isi database ini memang disimpan &
// dibaca sebagai UTC juga -- TAPI penggunanya di Indonesia (WIB, UTC+7,
// TIDAK ada DST). Akibatnya jam di grafik "Tren Pengiriman Pesan" &
// "Pertumbuhan Kontak Baru" geser 7 jam dari jam yang sama persis
// ditampilkan di "Riwayat Pengiriman" (yang formatnya pakai jam LOKAL
// browser lewat toLocaleString, lihat utils/formatDate.js FrontEnd).
//
// Perbaikannya: SEMUA hitungan "hari ini"/"bulan ini"/batas jam di sini
// sekarang eksplisit dalam WIB, bukan UTC.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Instant UTC "sekarang", digeser +7 jam supaya field getUTC*() dari hasilnya
 *  bisa dibaca LANGSUNG sebagai jam-dinding WIB (bukan UTC). */
function nowAsWibWallClock() {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

/** Kebalikan dari trik di atas: dari "jam-dinding WIB" (dibangun via
 *  Date.UTC(y, m, d, ...) yang field-nya sebenarnya WIB) balik ke instant
 *  UTC ASLI yang benar (buat dikirim ke query Postgres / dijadikan ISO
 *  string yang benar-benar merepresentasikan waktu itu). */
function wibWallClockToUtcInstant(y, m, d, hh = 0, mm = 0) {
  return new Date(Date.UTC(y, m, d, hh, mm) - WIB_OFFSET_MS);
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
  // "now", tapi field-nya (getUTCFullYear/getUTCMonth/dst) dibaca sebagai
  // jam-dinding WIB -- lihat nowAsWibWallClock() di atas.
  const nowWib = nowAsWibWallClock();

  if (granularity === "daily") {
    let y = nowWib.getUTCFullYear();
    let m = nowWib.getUTCMonth();
    let d = nowWib.getUTCDate();

    if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const [yy, mm, dd] = day.split("-").map(Number);
      // Kunci: tanggal yang dipilih HARUS di bulan & tahun WIB yang
      // berjalan -- kalau tidak, abaikan & tetap pakai hari ini (WIB).
      if (yy === y && mm - 1 === m) {
        d = dd;
      }
    }

    const start = wibWallClockToUtcInstant(y, m, d);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const buckets = [];
    for (let i = 0; i < 48; i++) buckets.push(new Date(start.getTime() + i * 30 * 60 * 1000).toISOString());
    return { start, end, buckets, truncUnit: "hour" };
  }

  if (granularity === "monthly") {
    const y = Number.isInteger(year) ? year : nowWib.getUTCFullYear();
    const m = Number.isInteger(month) ? month - 1 : nowWib.getUTCMonth(); // month: 1-12 dari FE
    const start = wibWallClockToUtcInstant(y, m, 1);
    // Bulan berikutnya (JS Date.UTC otomatis "rollover" m+1=12 -> Januari
    // tahun depan, dst -- tidak perlu ditangani manual).
    const end = wibWallClockToUtcInstant(y, m + 1, 1);
    const daysInMonth = Math.round((end - start) / (24 * 60 * 60 * 1000));
    const buckets = [];
    for (let i = 0; i < daysInMonth; i++) buckets.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString());
    return { start, end, buckets, truncUnit: "day" };
  }

  // yearly
  const y = Number.isInteger(year) ? year : nowWib.getUTCFullYear();
  const start = wibWallClockToUtcInstant(y, 0, 1);
  const end = wibWallClockToUtcInstant(y + 1, 0, 1);
  const buckets = [];
  for (let i = 0; i < 12; i++) buckets.push(wibWallClockToUtcInstant(y, i, 1).toISOString());
  return { start, end, buckets, truncUnit: "month" };
}

/** Isi ulang bucket kosong (count 0) supaya sumbu-X grafik selalu lengkap. */
function fillEmptyBuckets(rowsByBucket, buckets, shape) {
  return buckets.map((key) => rowsByBucket.get(key) ?? { date: key, ...shape });
}

/**
 * Ekspresi SQL untuk bucket waktu -- SEMUA dihitung di zona WAKTU WIB
 * ('Asia/Jakarta'), BUKAN UTC (lihat catatan WIB_OFFSET_MS di atas kenapa
 * ini penting -- server Postgres-nya sendiri jalan di UTC, "created_at
 * AT TIME ZONE 'Asia/Jakarta'" mengonversi ke jam-dinding WIB dulu SEBELUM
 * di-truncate, baru "AT TIME ZONE 'Asia/Jakarta'" yang KEDUA di paling
 * luar mengembalikannya jadi instant UTC yang benar lagi (supaya hasilnya
 * tetap timestamptz yang valid, konsisten dibandingkan sama kolom lain).
 *
 * 'daily' dipecah manual per 30 menit karena Postgres date_trunc() tidak
 * punya opsi bawaan "30 minute".
 */
function bucketExpr(granularity) {
  if (granularity === "daily") {
    return `(date_trunc('hour', created_at AT TIME ZONE 'Asia/Jakarta')
              + INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM created_at AT TIME ZONE 'Asia/Jakarta') / 30)
             ) AT TIME ZONE 'Asia/Jakarta'`;
  }
  if (granularity === "monthly") {
    return `date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`;
  }
  return `date_trunc('month', created_at AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`; // yearly
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