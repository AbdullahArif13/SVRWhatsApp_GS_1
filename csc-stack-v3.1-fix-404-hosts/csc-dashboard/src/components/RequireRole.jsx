import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * v3.11: gerbang ROLE -- bungkus route yang cuma boleh diakses role
 * tertentu (mis. Templates/Kontak/Chat/Riwayat/Manage User TIDAK boleh
 * diakses role 'pengguna', yang cuma boleh lihat Dashboard). Dipasang DI
 * DALAM RequireAuth (jadi role sudah pasti ada -- kalau belum login,
 * RequireAuth yang menangani redirect ke /login duluan).
 *
 * Kalau role tidak diizinkan, redirect ke /dashboard (BUKAN /login --
 * user ini SUDAH login sah, cuma tidak berhak di halaman ini).
 */
export default function RequireRole({ allow, children }) {
  const { role } = useAuth();

  if (!allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
