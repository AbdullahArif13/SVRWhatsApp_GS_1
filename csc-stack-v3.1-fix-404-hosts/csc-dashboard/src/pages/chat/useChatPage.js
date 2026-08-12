import { useEffect, useMemo, useState } from "react";
import { getMessageLogs } from "../../services/api.js";

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

export function useChatPage() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("loading");
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

  useEffect(() => {
    if (!selectedNoWa && conversations.length > 0) {
      setSelectedNoWa(conversations[0].no_wa);
    }
  }, [conversations, selectedNoWa]);

  const selectedConversation = conversations.find((c) => c.no_wa === selectedNoWa) ?? null;

  return {
    conversations,
    selectedConversation,
    selectedNoWa,
    setSelectedNoWa,
    status,
    errorMessage,
    loadLogs,
  };
}
