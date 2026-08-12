import { XCircle } from "lucide-react";
import { formatTimestamp } from "../../utils/formatDate.js";


export default function RejectReasonModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <XCircle size={18} className="text-red-500" /> Alasan Reject
          </h3>
        </div>

        <p className="text-sm text-gray-400">
          Dari <span className="font-medium text-gray-700">{log.recipient_name ?? log.no_wa}</span> ·
          template <span className="font-medium text-gray-700">{log.template_wa}</span>
          {log.replied_at ? ` · ${formatTimestamp(log.replied_at)}` : ""}
        </p>

        <div className="rounded-lg bg-red-50 p-4 text-sm text-gray-800">
          {log.reply_reason ? (
            <p>{log.reply_reason}</p>
          ) : (
            <p className="italic text-gray-400">Reject tanpa alasan (user tidak menuliskan alasan).</p>
          )}
        </div>

        {log.reply_raw_text && (
          <p className="text-xs text-gray-400">
            Balasan asli: <span className="font-mono text-gray-600">"{log.reply_raw_text}"</span>
          </p>
        )}

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
