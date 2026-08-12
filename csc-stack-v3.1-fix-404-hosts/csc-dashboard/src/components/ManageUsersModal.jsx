import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getUsersApi, createUserApi } from "../services/api.js";
import { usePagination } from "../hooks/usePagination.js";
import { formatTimestamp } from "../utils/formatDate.js";
import Pagination from "./Pagination.jsx";
import UserActivityModal from "./UserActivityModal.jsx";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  pengguna: "Pengguna",
  read_only: "Read Only",
};




const ADMIN_CREATABLE_ROLES = ["pengguna", "read_only"];
const ALL_ROLES = ["super_admin", "admin", "pengguna", "read_only"];


export default function ManageUsersModal({ onClose }) {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("loading"); 
  const [errorMessage, setErrorMessage] = useState("");
  const [viewingUserId, setViewingUserId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("pengguna");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const assignableRoles = useMemo(
    () => (myRole === "super_admin" ? ALL_ROLES : ADMIN_CREATABLE_ROLES),
    [myRole]
  );

  async function loadUsers() {
    setStatus("loading");
    try {
      const data = await getUsersApi();
      setUsers(data);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message || "Gagal mengambil daftar user.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const pagination = usePagination(users.length);
  const pagedUsers = users.slice(pagination.startIndex, pagination.endIndexExclusive);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createUserApi({ username: username.trim(), password, role });
      setUsers((prev) => [created, ...prev]);
      setUsername("");
      setPassword("");
      setRole("pengguna");
      setShowForm(false);
    } catch (error) {
      setFormError(error.message || "Gagal membuat user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manage User</h2>
            <p className="text-sm text-gray-400">Kelola akun login dashboard & pantau aktivitasnya.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <UserPlus size={16} />
            Tambah User
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <input
                type="password"
                placeholder="Password (min. 8 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="rounded-lg bg-gray-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm text-brand-red">{formError}</p>}
            <button
              type="submit"
              disabled={submitting || !username.trim() || !password}
              className="self-start rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Menyimpan..." : "Simpan"}
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {status === "loading" && <p className="text-sm text-gray-400">Memuat...</p>}
          {status === "error" && <p className="text-sm text-brand-red">{errorMessage}</p>}
          {status === "ready" && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="py-2">Username</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => setViewingUserId(user.id)}
                        className="font-medium text-brand hover:underline"
                        title="Lihat aktivitas user ini"
                      >
                        {user.username}
                      </button>
                    </td>
                    <td className="py-2.5 text-gray-600">{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td className="py-2.5 text-gray-500">{formatTimestamp(user.created_at)}</td>
                  </tr>
                ))}
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      Belum ada user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {status === "ready" && <Pagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} onToggleShowAll={pagination.setShowAll} />}
      </div>

      {viewingUserId && <UserActivityModal userId={viewingUserId} onClose={() => setViewingUserId(null)} />}
    </div>
  );
}
