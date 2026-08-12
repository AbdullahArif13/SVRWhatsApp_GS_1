import { pool } from "../db.js";

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

export async function deleteLoginSession(sid) {
  await pool.query("DELETE FROM session WHERE sid = $1", [sid]);
}
