import { pool } from "../db.js";

const VALID_GRANULARITIES = new Set(["daily", "monthly", "yearly"]);

export function isValidGranularity(value) {
  return VALID_GRANULARITIES.has(value);
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function nowAsWibWallClock() {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

function wibWallClockToUtcInstant(y, m, d, hh = 0, mm = 0) {
  return new Date(Date.UTC(y, m, d, hh, mm) - WIB_OFFSET_MS);
}

function range(granularity, { day, month, year } = {}) {
  
  
  const nowWib = nowAsWibWallClock();

  if (granularity === "daily") {
    let y = nowWib.getUTCFullYear();
    let m = nowWib.getUTCMonth();
    let d = nowWib.getUTCDate();

    if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const [yy, mm, dd] = day.split("-").map(Number);
      
      
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
    const m = Number.isInteger(month) ? month - 1 : nowWib.getUTCMonth(); 
    const start = wibWallClockToUtcInstant(y, m, 1);
    
    
    const end = wibWallClockToUtcInstant(y, m + 1, 1);
    const daysInMonth = Math.round((end - start) / (24 * 60 * 60 * 1000));
    const buckets = [];
    for (let i = 0; i < daysInMonth; i++) buckets.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString());
    return { start, end, buckets, truncUnit: "day" };
  }

  
  const y = Number.isInteger(year) ? year : nowWib.getUTCFullYear();
  const start = wibWallClockToUtcInstant(y, 0, 1);
  const end = wibWallClockToUtcInstant(y + 1, 0, 1);
  const buckets = [];
  for (let i = 0; i < 12; i++) buckets.push(wibWallClockToUtcInstant(y, i, 1).toISOString());
  return { start, end, buckets, truncUnit: "month" };
}


function fillEmptyBuckets(rowsByBucket, buckets, shape) {
  return buckets.map((key) => rowsByBucket.get(key) ?? { date: key, ...shape });
}

function bucketExpr(granularity) {
  if (granularity === "daily") {
    return `(date_trunc('hour', created_at AT TIME ZONE 'Asia/Jakarta')
              + INTERVAL '30 min' * FLOOR(EXTRACT(MINUTE FROM created_at AT TIME ZONE 'Asia/Jakarta') / 30)
             ) AT TIME ZONE 'Asia/Jakarta'`;
  }
  if (granularity === "monthly") {
    return `date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`;
  }
  return `date_trunc('month', created_at AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`; 
}

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