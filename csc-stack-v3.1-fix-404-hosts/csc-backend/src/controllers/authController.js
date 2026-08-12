import bcrypt from "bcryptjs";
import { findUserByUsername } from "../data/users.js";
import { listActiveLoginSessions, deleteLoginSession } from "../data/loginSessions.js";
import { logActivity } from "../data/activityLogs.js";


export async function handleLogin(req, res) {
  const { username, password } = req.body ?? {};

  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
  }

  const user = await findUserByUsername(username.trim());
  const hashToCompare = user?.password_hash ?? "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalidsaltuXPmO";
  const passwordMatches = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordMatches) {
    return res.status(401).json({ success: false, message: "Username atau password salah." });
  }

  req.session.regenerate((error) => {
    if (error) {
      console.error("[authController] Gagal regenerate session:", error?.message ?? error);
      return res.status(500).json({ success: false, message: "Gagal membuat sesi login." });
    }

    req.session.adminId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.loginAt = new Date().toISOString();

    req.session.save((saveError) => {
      if (saveError) {
        console.error("[authController] Gagal simpan session:", saveError?.message ?? saveError);
        return res.status(500).json({ success: false, message: "Gagal menyimpan sesi login." });
      }

      logActivity({
        actor: { userId: user.id, username: user.username, type: "user" },
        action: "login",
        entityType: "session",
        entityId: req.sessionID,
      });

      return res.status(200).json({ success: true, username: user.username, role: user.role });
    });
  });
}


export function handleLogout(req, res) {
  const actor = { userId: req.session?.adminId ?? null, username: req.session?.username ?? null, type: "user" };
  const sessionCookieName = req.session?.cookie ? "csc_session" : null;

  req.session.destroy((error) => {
    if (error) {
      console.error("[authController] Gagal hapus session:", error?.message ?? error);
      return res.status(500).json({ success: false, message: "Gagal logout." });
    }
    if (sessionCookieName) res.clearCookie(sessionCookieName);

    logActivity({ actor, action: "logout", entityType: "session" });

    return res.status(200).json({ success: true });
  });
}


export function handleMe(req, res) {
  if (!req.session?.adminId) {
    return res.status(200).json({ success: true, loggedIn: false });
  }
  return res.status(200).json({
    success: true,
    loggedIn: true,
    username: req.session.username,
    role: req.session.role,
    loginAt: req.session.loginAt,
  });
}


export async function handleListSessions(req, res) {
  const sessions = await listActiveLoginSessions();
  return res.status(200).json({
    success: true,
    data: sessions.map((s) => ({
      ...s,
      isCurrent: s.sid === req.sessionID,
    })),
  });
}


export async function handleDeleteSession(req, res) {
  const { sid } = req.params;
  if (sid === req.sessionID) {
    return res.status(400).json({ success: false, message: "Pakai /api/auth/logout untuk logout sesi sendiri." });
  }
  await deleteLoginSession(sid);

  logActivity({
    actor: { userId: req.session.adminId, username: req.session.username, type: "user" },
    action: "force_logout",
    entityType: "session",
    entityId: sid,
  });

  return res.status(200).json({ success: true });
}
