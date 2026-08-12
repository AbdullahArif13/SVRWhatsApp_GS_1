import { MessageCircle, RefreshCw, Send } from "lucide-react";
import Layout from "../../components/Layout.jsx";
import { formatDateDivider, formatRelativeTime, formatTime, previewText } from "../../utils/chatHelpers.js";

export default function ChatView({
  conversations,
  selectedConversation,
  selectedNoWa,
  setSelectedNoWa,
  status,
  errorMessage,
  loadLogs,
}) {
  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageCircle size={16} /> Chat
            </h2>
            <button
              type="button"
              onClick={loadLogs}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand"
              aria-label="Segarkan"
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
          {isFailed && <span className="font-semibold text-red-500">· Gagal</span>}
        </div>
      </div>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
        GS
      </div>
    </div>
  );
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
