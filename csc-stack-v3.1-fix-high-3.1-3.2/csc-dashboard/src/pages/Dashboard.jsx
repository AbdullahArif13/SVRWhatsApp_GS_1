import { useEffect, useMemo, useState } from "react";
import { RefreshCw, MessageSquareText, Users, FileText } from "lucide-react";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import PieChart from "../components/dashboard/PieChart.jsx";
import { getMessageLogs } from "../services/api.js";
import { useContacts } from "../context/ContactsContext.jsx";
import { useTemplates } from "../context/TemplatesContext.jsx";

const STATUS_COLORS = {
  terkirim: "#22c55e",
  gagal: "#ef4444",
  antri: "#f59e0b",
};
const STATUS_LABELS = {
  terkirim: "Terkirim",
  gagal: "Gagal",
  antri: "Antri",
};
const FALLBACK_COLOR = "#9ca3af";

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");

  const { contacts, loading: contactsLoading } = useContacts();
  const { templates } = useTemplates();

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

    const statusSlices = useMemo(() => {
    const counts = new Map();
    for (const log of logs) {
      const key = log.status || "tidak_diketahui";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([key, value]) => ({
      label: STATUS_LABELS[key] || key,
      value,
      color: STATUS_COLORS[key] || FALLBACK_COLOR,
    }));
  }, [logs]);

  const activeTemplateCount = useMemo(
    () => templates.filter((t) => !t.isDeleted).length,
    [templates]
  );

  return (
    <Layout>
      <PageHeader title="Dashboard" actionLabel="Segarkan" onAction={loadLogs} />

      <div className="px-8 pb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Ringkasan</h2>
          <p className="text-sm text-gray-400">Rangkuman aktivitas pengiriman, kontak, dan template.</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={MessageSquareText}
            label="Total Pesan (Semua Status)"
            value={logs.length}
            loading={status === "loading"}
          />
          <SummaryCard
            icon={Users}
            label="Jumlah Nomor WhatsApp"
            value={contacts.length}
            loading={contactsLoading}
          />
          <SummaryCard
            icon={FileText}
            label="Jumlah Template"
            value={activeTemplateCount}
            loading={false}
          />
        </div>

        <div className="rounded-2xl border border-gray-100 p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Status Pengiriman</h3>

          {status === "loading" && (
            <p className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw size={16} className="animate-spin" /> Memuat data...
            </p>
          )}

          {status === "error" && (
            <p className="text-sm text-red-500">{errorMessage} — pastikan backend sedang berjalan.</p>
          )}

          {status === "ready" && <PieChart slices={statusSlices} />}
        </div>
      </div>
    </Layout>
  );
}

function SummaryCard({ icon: Icon, label, value, loading }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
        <Icon size={20} className="text-brand" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{loading ? "…" : value}</p>
      </div>
    </div>
  );
}
