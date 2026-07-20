import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchBox from "../components/SearchBox.jsx";
import FilterSelect from "../components/FilterSelect.jsx";
import StatusBadge from "../components/messageHistory/StatusBadge.jsx";
import ReplyStatusBadge from "../components/messageHistory/ReplyStatusBadge.jsx";
import LogDetailModal from "../components/messageHistory/LogDetailModal.jsx";
import { formatTimestamp } from "../utils/formatDate.js";
import { getMessageLogs } from "../services/api.js";

// Opsi dropdown "Status" -- mengikuti nilai kolom `status` di message_logs
// ("terkirim" | "gagal"), ditampilkan pakai label yang sama seperti
// StatusBadge.
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
];

// Opsi dropdown "Balasan" -- mengikuti nilai kolom `reply_status`
// ("tidak_diperlukan" | "menunggu" | "approve" | "reject"), ditampilkan
// pakai label yang sama seperti ReplyStatusBadge, supaya user bisa
// mengecek langsung ada berapa banyak pesan di tiap kondisi balasan.
const REPLY_FILTER_OPTIONS = [
  { value: "all", label: "Semua Balasan" },
  { value: "tidak_diperlukan", label: "Tidak Diperlukan" },
  { value: "menunggu", label: "Menunggu Balasan" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
];

/**
 * Halaman ini READ-ONLY. FrontEnd TIDAK memicu pengiriman pesan -- pesan
 * benar-benar dikirim oleh sistem permintaan (mis. Web E-Picking) yang
 * memanggil backend secara langsung lewat POST /api/send-message.
 *
 * Fungsi halaman ini hanya menampilkan riwayat: ke nomor & nama siapa saja
 * setiap request itu ditujukan, pakai template apa, dan berhasil atau tidak.
 */
export default function MessageHistory() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [viewingLog, setViewingLog] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyFilter, setReplyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadLogs() {
    setStatus("loading");
    try {
      const data = await getMessageLogs();
      setLogs(data);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message || "Gagal mengambil riwayat pesan.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  // Filter Status (terkirim/gagal), Balasan (tidak_diperlukan/menunggu/
  // approve/reject), dan search bebas (nama tujuan, no. WA, atau nama
  // template) bisa dipakai bersamaan.
  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (replyFilter !== "all") {
        const replyStatus = log.reply_status || "tidak_diperlukan";
        if (replyStatus !== replyFilter) return false;
      }
      if (query) {
        const haystack = `${log.recipient_name ?? ""} ${log.no_wa ?? ""} ${log.template_wa ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [logs, statusFilter, replyFilter, searchQuery]);

  return (
    <Layout>
      <PageHeader title="Riwayat Pengiriman" actionLabel="Segarkan" onAction={loadLogs} />

      <div className="px-8 pb-8">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Riwayat Pesan dari Sistem Permintaan</h2>
            <p className="text-sm text-gray-400">
              Daftar pesan yang sudah dikirim oleh sistem permintaan.
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari nama, no. WA, atau template..."
          />
          <FilterSelect
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterSelect
            options={REPLY_FILTER_OPTIONS}
            value={replyFilter}
            onChange={setReplyFilter}
          />
        </div>

        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <RefreshCw size={16} className="animate-spin" /> Memuat riwayat...
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-red-500">{errorMessage} — pastikan backend sedang berjalan.</p>
        )}

        {status === "ready" && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="px-5 py-3 font-semibold text-gray-900">Nama Tujuan</th>
                <th className="px-5 py-3 font-semibold text-gray-900">No. WA</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Template</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Balasan</th>
                <th className="px-5 py-3 font-semibold text-gray-900">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-gray-400">
                    Belum ada pesan yang tercatat. Riwayat akan muncul di sini begitu sistem permintaan
                    mengirim pesan lewat backend.
                  </td>
                </tr>
              )}
              {logs.length > 0 && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-gray-400">
                    Tidak ada pesan yang cocok dengan filter/pencarian ini.
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="px-5 py-3 text-gray-700">
                    {log.recipient_name || <span className="text-gray-400">-</span>}
                  </td>
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
                    <ReplyStatusBadge replyStatus={log.reply_status} />
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatTimestamp(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewingLog && <LogDetailModal log={viewingLog} onClose={() => setViewingLog(null)} />}
    </Layout>
  );
}
