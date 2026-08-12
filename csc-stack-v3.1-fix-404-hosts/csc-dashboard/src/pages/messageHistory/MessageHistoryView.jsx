import { RefreshCw } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import SearchBox from "../../components/SearchBox.jsx";
import FilterSelect from "../../components/FilterSelect.jsx";
import Pagination from "../../components/Pagination.jsx";
import StatusBadge from "../../components/messageHistory/StatusBadge.jsx";
import ReplyStatusBadge from "../../components/messageHistory/ReplyStatusBadge.jsx";
import LogDetailModal from "../../components/messageHistory/LogDetailModal.jsx";
import RejectReasonModal from "../../components/messageHistory/RejectReasonModal.jsx";
import { formatTimestamp } from "../../utils/formatDate.js";

export default function MessageHistoryView({
  error,
  filteredLogs,
  load,
  pagedLogs,
  pagination,
  replyFilter,
  repliesOptions,
  searchQuery,
  selectedLog,
  selectedRejectLog,
  setReplyFilter,
  setSearchQuery,
  setStatusFilter,
  setViewingLog,
  setViewingRejectLog,
  status,
  statusFilter,
  statusOptions,
  viewingLog,
  viewingRejectLog,
}) {
  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="shrink-0">
          <PageHeader title="Riwayat Pengiriman" actionLabel="Segarkan" onAction={load} />
          <div className="px-8">
            <div className="mb-6 flex items-baseline justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Riwayat Pesan dari Sistem Permintaan</h2>
                <p className="text-sm text-gray-400">Daftar pesan yang sudah dikirim oleh sistem permintaan.</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-4">
              <SearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari nama, no. WA, atau template..."
              />
              <FilterSelect options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
              <FilterSelect options={repliesOptions} value={replyFilter} onChange={setReplyFilter} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw size={16} className="animate-spin" /> Memuat riwayat...
            </p>
          )}

          {status === "error" && (
            <p className="text-sm text-red-500">{error} — pastikan backend sedang berjalan.</p>
          )}

          {status === "ready" && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="sticky top-0 z-10 bg-gray-200 text-left">
                  <th className="w-12 px-5 py-3 font-semibold text-gray-900">No</th>
                  <th className="px-5 py-3 font-semibold text-gray-900">Nama Tujuan</th>
                  <th className="px-5 py-3 font-semibold text-gray-900">No. WA</th>
                  <th className="px-5 py-3 font-semibold text-gray-900">Template</th>
                  <th className="px-5 py-3 font-semibold text-gray-900">Status</th>
                  <th className="px-5 py-3 font-semibold text-gray-900">Balasan</th>
                  <th className="px-5 py-3 font-semibold text-gray-900">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-gray-400">
                      Tidak ada pesan yang cocok dengan filter/pencarian ini.
                    </td>
                  </tr>
                ) : (
                  pagedLogs.map((log, index) => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="px-5 py-3 text-gray-500">{pagination.startIndex + index + 1}</td>
                      <td className="px-5 py-3 text-gray-700">{log.recipient_name || <span className="text-gray-400">-</span>}</td>
                      <td className="px-5 py-3 text-gray-500">{log.no_wa}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setViewingLog(log)}
                          className="text-gray-700 underline-offset-2 transition-colors hover:text-brand hover:underline"
                        >
                          {log.template_wa}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-5 py-3">
                        <ReplyStatusBadge
                          replyStatus={log.reply_status}
                          onClick={log.reply_status === "reject" ? () => setViewingRejectLog(log) : undefined}
                        />
                      </td>
                      <td className="px-5 py-3 text-gray-500">{formatTimestamp(log.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {status === "ready" && filteredLogs.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 px-8 py-4">
            <Pagination
              {...pagination}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              onToggleShowAll={pagination.setShowAll}
            />
          </div>
        )}
      </div>

      {viewingLog && <LogDetailModal log={viewingLog} onClose={() => setViewingLog(null)} />}
      {viewingRejectLog && (
        <RejectReasonModal log={viewingRejectLog} onClose={() => setViewingRejectLog(null)} />
      )}
    </Layout>
  );
}
