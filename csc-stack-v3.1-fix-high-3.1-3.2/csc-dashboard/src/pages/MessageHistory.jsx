import { useEffect, useMemo, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SearchBox from "../components/SearchBox.jsx";
import { getMessageLogs } from "../services/api.js";

// Opsi dropdown "Status" -- mengikuti nilai kolom `status` di message_logs
// ("terkirim" | "gagal"), ditampilkan pakai label yang sama seperti
// StatusBadge di bawah.
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
];

// Opsi dropdown "Balasan" -- mengikuti nilai kolom `reply_status`
// ("tidak_diperlukan" | "menunggu" | "approve" | "reject"), ditampilkan
// pakai label yang sama seperti ReplyStatusBadge di bawah, supaya user bisa
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
    <Layout showWatermark={status === "ready" && logs.length === 0}>
      <PageHeader title="Riwayat Pengiriman" actionLabel="Refresh" onAction={loadLogs} />

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

function FilterSelect({ options, value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg bg-brand px-5 py-2.5 pr-10 text-sm font-semibold text-white outline-none hover:bg-brand-hover"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-900">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white">▾</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const isSent = status === "terkirim";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isSent ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
      }`}
    >
      {isSent ? "Terkirim" : "Gagal"}
    </span>
  );
}

/**
 * v3.2: status balasan Approve/Reject.
 *  - "tidak_diperlukan" : template ini require_reply = false -> tidak ada badge/"-".
 *  - "menunggu"          : require_reply = true, belum ada balasan valid.
 *  - "approve" / "reject": user sudah membalas dengan kata yang valid.
 */
function ReplyStatusBadge({ replyStatus }) {
  if (!replyStatus || replyStatus === "tidak_diperlukan") {
    return <span className="text-gray-400">-</span>;
  }
  const styleByStatus = {
    menunggu: "bg-yellow-100 text-yellow-700",
    approve: "bg-green-100 text-green-600",
    reject: "bg-red-100 text-red-500",
  };
  const labelByStatus = {
    menunggu: "Menunggu Balasan",
    approve: "Approve",
    reject: "Reject",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styleByStatus[replyStatus] ?? "bg-gray-100 text-gray-500"}`}>
      {labelByStatus[replyStatus] ?? replyStatus}
    </span>
  );
}

function formatTimestamp(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LogDetailModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col gap-4 rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <History size={18} /> {log.template_wa}
            </h3>
            <p className="text-sm text-gray-400">
              Ke {log.recipient_name ?? "-"} ({log.no_wa}) &middot; {formatTimestamp(log.created_at)}
            </p>
          </div>
          <StatusBadge status={log.status} />
        </div>

        {log.require_reply && (
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-2">
            <span className="text-sm font-medium text-gray-900">Balasan Approve/Reject</span>
            <ReplyStatusBadge replyStatus={log.reply_status} />
          </div>
        )}

        {log.require_reply && log.reply_raw_text && (
          <p className="text-xs text-gray-400">
            Balasan diterima: <span className="font-mono text-gray-600">"{log.reply_raw_text}"</span>
            {log.replied_at ? ` · ${formatTimestamp(log.replied_at)}` : ""}
          </p>
        )}

        {log.status === "gagal" && log.error_message && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-500">{log.error_message}</p>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">Isi Pesan</p>
          <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
            {log.final_message}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">Data Variabel yang Dikirim</p>
          <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
            {Object.entries(log.values ?? {}).map(([key, value]) => (
              <p key={key}>
                <span className="font-medium">{key}</span>: {value}
              </p>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
