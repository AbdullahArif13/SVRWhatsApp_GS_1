import bcrypt from "bcryptjs";
import { listUsersPaginated, createUser, findUserByUsername, findUserById } from "../data/users.js";
import { listActivityLogsByUser } from "../data/activityLogs.js";
import { logActivity } from "../data/activityLogs.js";

const VALID_ROLES = ["super_admin", "admin", "pengguna", "read_only"];



const ADMIN_CREATABLE_ROLES = ["pengguna", "read_only"];
const MAX_PAGE_SIZE = 100;

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.pageSize, 10) || 10));
  return { page, pageSize };
}


export async function handleListUsers(req, res) {
  const { page, pageSize } = parsePagination(req.query);
  const result = await listUsersPaginated({ page, pageSize });
  return res.status(200).json({ success: true, ...result });
}


export async function handleCreateUser(req, res) {
  const { username, password, role } = req.body ?? {};
  const actorRole = req.session.role;

  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ success: false, message: "Field 'username' wajib diisi." });
  }
  if (username.trim().length > 100) {
    return res.status(400).json({ success: false, message: "Field 'username' terlalu panjang (maks 100 karakter)." });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ success: false, message: "Field 'password' wajib diisi, minimal 8 karakter." });
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: `Field 'role' harus salah satu dari: ${VALID_ROLES.join(", ")}.` });
  }

  if (actorRole === "admin" && !ADMIN_CREATABLE_ROLES.includes(role)) {
    return res.status(403).json({
      success: false,
      message: `Admin hanya boleh membuat akun dengan role: ${ADMIN_CREATABLE_ROLES.join(", ")}. Hubungi Super Admin untuk membuat akun Admin/Super Admin.`,
    });
  }

  const existing = await findUserByUsername(username.trim());
  if (existing) {
    return res.status(409).json({ success: false, message: `Username '${username.trim()}' sudah dipakai.` });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    username: username.trim(),
    passwordHash,
    role,
    createdBy: req.session.adminId,
  });

  logActivity({
    actor: { userId: req.session.adminId, username: req.session.username, type: "user" },
    action: "create",
    entityType: "user",
    entityId: user.id,
    detail: { username: user.username, role: user.role },
  });

  return res.status(201).json({ success: true, data: user });
}

export async function handleGetUserActivity(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "id tidak valid." });
  }

  const user = await findUserById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: `User dengan id ${id} tidak ditemukan.` });
  }

  const { page, pageSize } = parsePagination(req.query);
  const result = await listActivityLogsByUser(id, { page, pageSize });
  return res.status(200).json({ success: true, user, ...result });
}
