import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * v3.10: gerbang route -- bungkus route mana pun yang WAJIB sudah login.
 * "loading" (masih cek sesi ke backend, lihat AuthContext.jsx) sengaja
 * ditampilkan layar kosong dulu, BUKAN langsung redirect ke /login --
 * supaya user yang sesinya sebenarnya masih valid tidak "kelip" balik ke
 * halaman Login sebelum akhirnya masuk lagi.
 */
export default function RequireAuth({ children }) {
  const { status } = useAuth();

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center text-sm text-gray-400">Memuat...</div>;
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
