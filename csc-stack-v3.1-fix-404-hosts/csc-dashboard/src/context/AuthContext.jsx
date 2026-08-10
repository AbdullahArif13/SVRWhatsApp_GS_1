import { createContext, useContext, useEffect, useState } from "react";
import { getMeApi, loginApi, logoutApi } from "../services/api.js";

const AuthContext = createContext(null);

/**
 * v3.10: status login dashboard (Admin, username+password, sesi lewat
 * cookie -- lihat services/api.js). Dipasang di App.jsx MEMBUNGKUS semua
 * route, supaya status login bisa dibaca dari halaman mana pun (Login.jsx
 * buat submit form, TopBar.jsx buat tombol logout, App.jsx buat redirect
 * ke /login kalau belum login).
 *
 * `status`: "loading" (masih cek sesi ke backend) | "authenticated" |
 * "guest" (belum login). Dipisah dari boolean biasa supaya App.jsx bisa
 * tampilkan layar kosong/spinner dulu selagi "loading", BUKAN keliru
 * redirect ke /login sesaat sebelum ternyata sesinya valid.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [username, setUsername] = useState(null);
  // v3.11: 'super_admin' | 'admin' | 'pengguna'. Dipakai RequireRole.jsx
  // (gate route) dan Sidebar.jsx (menu mana yang ditampilkan per role).
  const [role, setRole] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getMeApi()
      .then((data) => {
        if (cancelled) return;
        if (data?.loggedIn) {
          setUsername(data.username);
          setRole(data.role);
          setStatus("authenticated");
        } else {
          setStatus("guest");
        }
      })
      .catch(() => {
        // Backend tidak bisa dihubungi sama sekali -- anggap belum login
        // (bukan crash) supaya Login.jsx tetap kelihatan, bukan layar putih.
        if (!cancelled) setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(usernameInput, password) {
    const data = await loginApi({ username: usernameInput, password });
    setUsername(data.username);
    setRole(data.role);
    setStatus("authenticated");
  }

  async function logout() {
    try {
      await logoutApi();
    } finally {
      // Tetap anggap logout SUKSES di sisi FrontEnd walau request-nya
      // gagal (mis. sesi sudah expired duluan di backend) -- yang penting
      // user kembali ke halaman Login, bukan nyangkut kebingungan.
      setUsername(null);
      setRole(null);
      setStatus("guest");
    }
  }

  return (
    <AuthContext.Provider value={{ status, username, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() harus dipakai di dalam <AuthProvider>.");
  return ctx;
}
