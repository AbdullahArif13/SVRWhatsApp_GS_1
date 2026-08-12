import { RefreshCw, LogOut } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { formatTimestamp } from "../../utils/formatDate.js";

export default function LoginSessionsView({
  canForceLogout,
  sessions,
  status,
  errorMessage,
  revokingId,
  loadSessions,
  handleRevoke,
}) {
  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="shrink-0">
          <PageHeader title="Sesi Login" />
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Daftar sesi login yang sedang aktif di dashboard ini.</p>
            <button
              type="button"
              onClick={loadSessions}
              className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RefreshCw size={16} />
              Muat Ulang
            </button>
          </div>

          {status === "loading" && <p className="text-sm text-gray-400">Memuat...</p>}
          {status === "error" && <p className="text-sm text-brand-red">{errorMessage}</p>}

          {status === "ready" && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="py-3">Username</th>
                  <th className="py-3">Waktu Login</th>
                  <th className="py-3">Kedaluwarsa</th>
                  {canForceLogout && <th className="py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.sid} className="border-b border-gray-50">
                    <td className="py-3 font-medium text-gray-900">
                      {session.username ?? "(tidak diketahui)"}
                      {session.isCurrent && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          Sesi ini
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600">{formatTimestamp(session.loginAt)}</td>
                    <td className="py-3 text-gray-600">{formatTimestamp(session.expiresAt)}</td>
                    {canForceLogout && (
                      <td className="py-3 text-right">
                        {!session.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(session.sid)}
                            disabled={revokingId === session.sid}
                            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-brand-red transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <LogOut size={14} />
                            Paksa Logout
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={canForceLogout ? 4 : 3} className="py-6 text-center text-gray-400">
                      Tidak ada sesi login aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
