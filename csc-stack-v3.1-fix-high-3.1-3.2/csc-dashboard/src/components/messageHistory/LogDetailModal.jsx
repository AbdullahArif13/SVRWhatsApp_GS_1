import { History } from "lucide-react";
import { formatTimestamp } from "../../utils/formatDate.js";
import StatusBadge from "./StatusBadge.jsx";
import ReplyStatusBadge from "./ReplyStatusBadge.jsx";

export default function LogDetailModal({ log, onClose }) {
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
