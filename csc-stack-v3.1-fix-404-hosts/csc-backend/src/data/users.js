import { pool } from "../db.js";

const PUBLIC_COLUMNS = "id, username, role, created_by, created_at";

export async function findUserByUsername(username) {
  const { rows } = await pool.query(
    `SELECT id, username, password_hash, role, created_by, created_at FROM users WHERE username = $1 LIMIT 1`,
    [username]
  );
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

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

export async function createUser({ username, passwordHash, role, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, role, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [username, passwordHash, role, createdBy ?? null]
  );
  return rows[0];
}
