import { useEffect, useState } from "react";
import { getUserActivityApi } from "../services/api.js";
import { usePagination } from "../hooks/usePagination.js";
import { formatTimestamp } from "../utils/formatDate.js";
import Pagination from "./Pagination.jsx";




const ACTION_LABELS = {
  create: "Membuat",
  update: "Mengubah",
  delete: "Menghapus permanen",
  soft_delete: "Menghapus (arsip)",
  restore: "Memulihkan",
  activate: "Mengaktifkan",
  deactivate: "Menonaktifkan",
  login: "Login",
  logout: "Logout",
  force_logout: "Memaksa logout sesi lain",
  send_message: "Mengirim pesan",
};

const ENTITY_LABELS = {
  template: "Template",
  contact: "Kontak",
  message: "Pesan",
  user: "User",
  session: "Sesi",
};

function describeActivity(activity) {
  const action = ACTION_LABELS[activity.action] ?? activity.action;
  const entity = ENTITY_LABELS[activity.entity_type] ?? activity.entity_type;
  const detailName = activity.detail?.name ?? activity.detail?.username ?? activity.detail?.no_wa ?? activity.detail?.template_wa;
  return detailName ? `${action} ${entity} "${detailName}"` : `${action} ${entity}`;
}


export default function UserActivityModal({ userId, onClose }) {
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [status, setStatus] = useState("loading"); 
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getUserActivityApi(userId)
      .then(({ user: fetchedUser, activities: fetchedActivities }) => {
        if (cancelled) return;
        setUser(fetchedUser);
        setActivities(fetchedActivities);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error.message || "Gagal mengambil riwayat aktivitas.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const pagination = usePagination(activities.length);
  const pagedActivities = activities.slice(pagination.startIndex, pagination.endIndexExclusive);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Aktivitas {user?.username ?? "..."}
          </h2>
          <p className="text-sm text-gray-400">Riwayat semua aksi yang pernah dilakukan user ini.</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {status === "loading" && <p className="text-sm text-gray-400">Memuat...</p>}
          {status === "error" && <p className="text-sm text-brand-red">{errorMessage}</p>}
          {status === "ready" && (
            <ul className="flex flex-col divide-y divide-gray-50">
              {pagedActivities.map((activity) => (
                <li key={activity.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-gray-800">{describeActivity(activity)}</span>
                  <span className="shrink-0 text-xs text-gray-400">{formatTimestamp(activity.created_at)}</span>
                </li>
              ))}
              {pagedActivities.length === 0 && (
                <li className="py-6 text-center text-gray-400">Belum ada aktivitas.</li>
              )}
            </ul>
          )}
        </div>

        {status === "ready" && <Pagination {...pagination} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} onToggleShowAll={pagination.setShowAll} />}

        <button
          type="button"
          onClick={onClose}
          className="self-end rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
