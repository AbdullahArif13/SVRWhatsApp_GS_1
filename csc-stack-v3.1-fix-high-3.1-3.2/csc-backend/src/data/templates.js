import { pool } from "../db.js";
export async function listTemplates() {
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, created_at FROM templates ORDER BY created_at DESC"
  );
  return rows;
}

export async function findTemplateByName(name) {
  if (!name) return null;
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, created_at FROM templates WHERE LOWER(name) = LOWER($1) AND is_active = true AND is_deleted = false LIMIT 1",
    [String(name).trim()]
  );
  return rows[0] ?? null;
}

export async function findTemplateById(id) {
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, created_at FROM templates WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0] ?? null;
}

export async function findAnyTemplateByName(name) {
  if (!name) return null;
  const { rows } = await pool.query(
    "SELECT id, name, body, status, is_active, is_deleted, require_reply, created_at FROM templates WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [String(name).trim()]
  );
  return rows[0] ?? null;
}

export async function createTemplate({ name, body, status = "Approve", requireReply = false }) {
  const { rows } = await pool.query(
    "INSERT INTO templates (name, body, status, require_reply) VALUES ($1, $2, $3, $4) RETURNING id",
    [name, body, status, Boolean(requireReply)]
  );
  return findTemplateById(rows[0].id);
}

export async function updateTemplate(id, { name, body, requireReply }) {
  await pool.query(
    "UPDATE templates SET name = $1, body = $2, require_reply = COALESCE($3, require_reply) WHERE id = $4",
    [name, body, requireReply === undefined ? null : Boolean(requireReply), id]
  );
  return findTemplateById(id);
}

export async function setTemplateActive(id, isActive) {
  await pool.query("UPDATE templates SET is_active = $1 WHERE id = $2", [Boolean(isActive), id]);
  return findTemplateById(id);
}

export async function setTemplateDeleted(id, isDeleted) {
  await pool.query("UPDATE templates SET is_deleted = $1 WHERE id = $2", [Boolean(isDeleted), id]);
  return findTemplateById(id);
}

export async function deleteTemplateForever(id) {
  const result = await pool.query("DELETE FROM templates WHERE id = $1", [id]);
  return result.rowCount > 0;
}
