import bcrypt from "bcryptjs";
import { findUserByUsername } from "../data/users.js";
import { listActiveLoginSessions, deleteLoginSession } from "../data/loginSessions.js";
import { logActivity } from "../data/activityLogs.js";

/**
 * POST /api/auth/login
 *
 * v3.11: login dashboard, 3 role (super_admin/admin/pengguna, lihat
 * data/users.js). Password dicocokkan lewat bcrypt.compare ke
 * password_hash di tabel `users` (TIDAK PERNAH dibandingkan sebagai
 * plaintext).
 *
 * Sukses -> req.session di-regenerate (cegah session fixation: sid lama
 * dibuang, sid baru dibuat) lalu diisi { adminId, username, role,
 * loginAt } -- field `role` inilah yang dipakai requireRole.js dan
 * FrontEnd (Sidebar per-role, tombol Paksa Logout khusus Super Admin, dst).
 */
export async function handleLogin(req, res) {
  const { username, password } = req.body ?? {};

  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
  }

  const user = await findUserByUsername(username.trim());
  // Tetap jalankan bcrypt.compare walau user tidak ketemu (pakai hash
  // dummy) -- supaya waktu respons "username tidak ada" vs "password
  // salah" TIDAK bisa dibedakan lewat timing, mencegah enumerasi username.
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

/** POST /api/auth/logout -- hapus sesi saat ini (cookie di browser ikut diminta dihapus). */
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

/**
 * GET /api/auth/me
 *
 * Dipanggil FrontEnd sekali di awal (saat dashboard dibuka) untuk tahu
 * apakah browser ini masih punya sesi login yang valid atau tidak --
 * SENGAJA selalu balas 200 (bukan 401) baik login maupun tidak, karena
 * "belum login" itu bukan error, cuma informasi biasa buat FrontEnd
 * memutuskan tampilkan halaman Login atau dashboard. `role` dipakai
 * FrontEnd buat tampilkan Sidebar/fitur yang sesuai hak akses.
 */
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

/**
 * GET /api/auth/sessions
 *
 * "Sesi Login" di sidebar -- daftar semua sesi yang SEDANG aktif (belum
 * expired), supaya Admin/Super Admin tahu siapa saja yang sedang login ke
 * dashboard ini. Dibatasi requireRole('super_admin', 'admin') di
 * authRoutes.js -- role 'pengguna' tidak bisa akses ini sama sekali.
 */
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

/**
 * DELETE /api/auth/sessions/:sid
 *
 * Paksa-logout SATU sesi lain. v3.11: HANYA Super Admin (requireRole di
 * authRoutes.js) -- ini persis pembeda yang diminta antara Admin & Super
 * Admin (Admin bisa lihat daftar sesi buat memantau, tapi TIDAK bisa
 * paksa-logout siapa pun).
 *
 * Tidak bisa dipakai untuk hapus sesi SENDIRI lewat sini -- pakai
 * POST /api/auth/logout untuk itu (biar cookie di browser ini juga
 * ke-clear, bukan cuma baris di DB-nya).
 */
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
