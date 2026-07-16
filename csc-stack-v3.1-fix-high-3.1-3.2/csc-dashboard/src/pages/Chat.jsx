import { useEffect, useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Send } from "lucide-react";
import Layout from "../components/Layout.jsx";
import { getMessageLogs } from "../services/api.js";

/**
 * Halaman ini READ-ONLY, sama prinsipnya seperti MessageHistory.jsx --
 * bedanya di sini riwayat ditampilkan per-kontak dalam bentuk chat thread
 * (mirip tampilan WhatsApp), bukan tabel flat.
 *
 * PENTING: FrontEnd TIDAK BISA mengirim pesan dari halaman ini. Kotak
 * pesan di bawah sengaja di-disable -- pengiriman pesan cuma bisa terjadi
 * lewat sistem permintaan (mis. Web E-Picking) yang memanggil
 * POST /api/send-message langsung ke backend. Halaman ini murni buat
 * melihat isi percakapan yang sudah pernah terjadi ke tiap nomor.
 */
export default function Chat() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedNoWa, setSelectedNoWa] = useState(null);

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

  const conversations = useMemo(() => groupByContact(logs), [logs]);

  // Otomatis pilih kontak pertama begitu daftar percakapan siap.
  useEffect(() => {
    if (!selectedNoWa && conversations.length > 0) {
      setSelectedNoWa(conversations[0].no_wa);
    }
  }, [conversations, selectedNoWa]);

  const selectedConversation = conversations.find((c) => c.no_wa === selectedNoWa) ?? null;

  return (
    <Layout showWatermark={status === "ready" && conversations.length === 0}>
      {/* h-[calc(100vh-4rem)] dipakai (bukan h-full) supaya panel chat ini
          selalu mengisi penuh sisa layar di bawah TopBar (TopBar tingginya
          4rem / h-16), jadi kotak input selalu nempel di bawah layar --
          bukan ngikutin tinggi konten pesan doang. */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Daftar kontak yang pernah dikirimi pesan */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageCircle size={16} /> Chat
            </h2>
            <button
              type="button"
              onClick={loadLogs}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand"
              aria-label="Refresh"
            >
              <RefreshCw size={15} className={status === "loading" ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {status === "loading" && conversations.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400">Memuat...</p>
            )}
            {status === "error" && <p className="px-5 py-6 text-sm text-red-500">{errorMessage}</p>}
            {status === "ready" && conversations.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400">
                Belum ada pesan yang tercatat. Percakapan akan muncul di sini begitu ada pesan yang
                terkirim.
              </p>
            )}
            {conversations.map((conv) => {
              const lastMessage = conv.messages[conv.messages.length - 1];
              const isActive = conv.no_wa === selectedNoWa;
              return (
                <button
                  key={conv.no_wa}
                  type="button"
                  onClick={() => setSelectedNoWa(conv.no_wa)}
                  className={`flex w-full items-center gap-3 border-b border-gray-50 px-5 py-3 text-left transition-colors ${
                    isActive ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-500">
                    {conv.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{conv.name}</p>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatRelativeTime(lastMessage?.created_at)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-500">{previewText(lastMessage)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Isi percakapan kontak yang dipilih */}
        <section className="relative flex flex-1 flex-col">
          {selectedConversation ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedConversation.name}</h2>
                  <p className="text-xs text-gray-400">{selectedConversation.no_wa}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {groupByDate(selectedConversation.messages).map(({ dateLabel, messages }) => (
                  <div key={dateLabel}>
                    <p className="mb-4 text-center text-xs text-gray-400">{dateLabel}</p>
                    <div className="mb-6 flex flex-col gap-3">
                      {messages.map((log) => (
                        <ChatBubble key={log.id} log={log} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sengaja di-disable: halaman ini cuma buat lihat, bukan kirim pesan. */}
              <div className="border-t border-gray-100 px-6 py-4">
                <div className="flex items-center gap-3 rounded-full bg-gray-100 px-4 py-2.5 opacity-60">
                  <input
                    type="text"
                    disabled
                    placeholder="Read only — halaman ini hanya untuk melihat riwayat chat"
                    className="flex-1 cursor-not-allowed bg-transparent text-sm text-gray-500 outline-none"
                  />
                  <Send size={18} className="text-gray-400" />
                </div>
              </div>
            </>
          ) : (
            status === "ready" && (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                Pilih kontak di sebelah kiri untuk melihat riwayat chat.
              </div>
            )
          )}
        </section>
      </div>
    </Layout>
  );
}

function ChatBubble({ log }) {
  const isFailed = log.status === "gagal";
  return (
    <div className="flex items-end justify-end gap-2">
      <div
        className={`max-w-md rounded-2xl px-4 py-3 text-sm ${
          isFailed ? "border border-red-200 bg-red-50 text-red-600" : "bg-blue-100 text-gray-800"
        }`}
      >
        <p className="whitespace-pre-wrap">{log.final_message}</p>
        <div className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-gray-400">
          <span>{formatTime(log.created_at)}</span>
          {isFailed && <span className="font-semibold text-red-500">&middot; Gagal</span>}
        </div>
      </div>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
        GS
      </div>
    </div>
  );
}

function groupByContact(logs) {
  const map = new Map();
  for (const log of logs) {
    const key = log.no_wa;
    if (!map.has(key)) {
      map.set(key, { no_wa: key, name: log.recipient_name || key, messages: [] });
    }
    map.get(key).messages.push(log);
  }

  const conversations = Array.from(map.values()).map((conv) => ({
    ...conv,
    messages: [...conv.messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));

  conversations.sort((a, b) => {
    const aTime = a.messages[a.messages.length - 1]?.created_at ?? 0;
    const bTime = b.messages[b.messages.length - 1]?.created_at ?? 0;
    return new Date(bTime) - new Date(aTime);
  });

  return conversations;
}

function groupByDate(messages) {
  const groups = [];
  let currentLabel = null;
  let currentGroup = null;

  for (const log of messages) {
    const label = formatDateDivider(log.created_at);
    if (label !== currentLabel) {
      currentLabel = label;
      currentGroup = { dateLabel: label, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(log);
  }

  return groups;
}

function previewText(log) {
  if (!log) return "";
  return log.final_message?.split("\n")[0] ?? "";
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} Min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} Jam`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} Hari`;
}

function formatDateDivider(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
