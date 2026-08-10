import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * v3.10: halaman login dashboard -- Admin-only untuk saat ini (satu role,
 * bisa akses semua fitur dashboard begitu login). Standalone (TIDAK
 * dibungkus <Layout>, tidak ada Sidebar/TopBar) -- belum ada sesi yang
 * boleh ditampilkan menu-nya sebelum login berhasil.
 */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login(username.trim(), password);
      navigate("/contacts", { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Gagal login.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/gs-favicon.png" alt="GS" className="h-14 w-14" />
          <h1 className="text-lg font-semibold text-gray-900">CSC_IT_GS Dashboard</h1>
          <p className="text-sm text-gray-500">Silakan login untuk melanjutkan</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-xs font-medium text-gray-600">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-lg bg-gray-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-medium text-gray-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg bg-gray-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            className="mt-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Memproses..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
