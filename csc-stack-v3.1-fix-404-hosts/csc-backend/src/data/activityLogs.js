import { pool } from "../db.js";

export function actorFromRequest(req) {
  if (req.session?.adminId) {
    return { userId: req.session.adminId, username: req.session.username, type: "user" };
  }
  return {
    userId: null,
    username: req.apiClient === "system" ? "system_api_key" : "backend_api_key",
    type: "system",
  };
}

export async function logActivity({ actor, action, entityType, entityId = null, detail = null }) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_user_id, actor_username, actor_type, action, entity_type, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actor?.userId ?? null,
        actor?.username ?? null,
        actor?.type ?? "system",
        action,
        entityType,
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        detail ? JSON.stringify(detail) : null,
      ]
    );
  } catch (error) {
    console.error("[activityLogs] Gagal mencatat aktivitas:", error?.message ?? error);
  }
}

export async function listActivityLogsByUser(userId, { page = 1, pageSize = 10 }) {
  const offset = (page - 1) * pageSize;

  const [{ rows: totalRows }, { rows }] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM activity_logs WHERE actor_user_id = $1", [userId]),
    pool.query(
      `SELECT id, actor_username, actor_type, action, entity_type, entity_id, detail, created_at
         FROM activity_logs
        WHERE actor_user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    ),
  ]);

  return { data: rows, total: totalRows[0].total, page, pageSize };
}
