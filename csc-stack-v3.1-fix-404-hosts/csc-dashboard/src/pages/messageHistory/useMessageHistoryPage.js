import { useEffect, useMemo, useState } from "react";
import { getMessageLogs } from "../../services/api.js";
import { useAsyncData } from "../../hooks/useAsyncData.js";
import { usePagination } from "../../hooks/usePagination.js";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
  { value: "antri", label: "Antri" },
];

const REPLY_FILTER_OPTIONS = [
  { value: "all", label: "Semua Balasan" },
  { value: "tidak_diperlukan", label: "Tidak Diperlukan" },
  { value: "menunggu", label: "Menunggu Balasan" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
];

export function useMessageHistoryPage() {
  const { data: logs, status, error, load } = useAsyncData([]);
  const [viewingLog, setViewingLog] = useState(null);
  const [viewingRejectLog, setViewingRejectLog] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyFilter, setReplyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    load(getMessageLogs);
  }, [load]);

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
        return haystack.includes(query);
      }
      return true;
    });
  }, [logs, statusFilter, replyFilter, searchQuery]);

  const pagination = usePagination(filteredLogs.length);
  useEffect(() => {
    pagination.resetPage();
  }, [statusFilter, replyFilter, searchQuery, pagination]);

  const pagedLogs = filteredLogs.slice(pagination.startIndex, pagination.endIndexExclusive);

  return {
    error,
    filteredLogs,
    load,
    pagedLogs,
    pagination,
    repliesOptions: REPLY_FILTER_OPTIONS,
    replyFilter,
    selectedLog: viewingLog,
    selectedRejectLog: viewingRejectLog,
    setReplyFilter,
    setSearchQuery,
    setStatusFilter,
    setViewingLog,
    setViewingRejectLog,
    status,
    statusOptions: STATUS_FILTER_OPTIONS,
    statusFilter,
    viewingLog,
    viewingRejectLog,
  };
}
