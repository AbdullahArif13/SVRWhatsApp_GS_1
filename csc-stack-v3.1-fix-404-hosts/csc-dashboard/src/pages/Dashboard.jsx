import { useEffect, useMemo, useState } from "react";
import { RefreshCw, MessageSquareText, Users, FileText } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Layout from "../components/Layout.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { getAnalyticsOverviewApi } from "../services/api.js";
import { useContacts } from "../context/ContactsContext.jsx";
import { useTemplates } from "../context/TemplatesContext.jsx";

// Warna disamain sama StatusBadge.jsx (terkirim = hijau, gagal = merah)
// supaya konsisten sama tabel Riwayat Pengiriman.
const STATUS_COLORS = { terkirim: "#22c55e", gagal: "#ef4444", antri: "#f59e0b" };
const STATUS_LABELS = { terkirim: "Terkirim", gagal: "Gagal", antri: "Antri" };
const REPLY_COLORS = { approve: "#22c55e", reject: "#ef4444", menunggu: "#f59e0b", tidak_diperlukan: "#9ca3af" };
const REPLY_LABELS = { approve: "Approve", reject: "Reject", menunggu: "Menunggu", tidak_diperlukan: "Tidak Diperlukan" };
const FALLBACK_COLOR = "#9ca3af";
const TEMPLATE_BAR_COLOR = "#1d6fe0";

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Harian" },
  { value: "monthly", label: "Bulanan" },
  { value: "yearly", label: "Tahunan" },
];

/** Format label sumbu-X grafik tren sesuai granularity yang dipilih. */
function formatBucketLabel(isoDate, granularity) {
  const date = new Date(isoDate);
  if (granularity === "yearly") return date.getUTCFullYear().toString();
  if (granularity === "monthly") return date.toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * v3.11: Dashboard analitik interaktif -- dipakai SEMUA role (termasuk
 * 'pengguna'/read-only, yang cuma boleh akses halaman ini). Datanya dari
 * GET /api/analytics/overview (lihat services/api.js) -- endpoint yang
 * SAMA juga bisa dipakai integrasi eksternal lewat X-API-Key kalau nanti
 * ada pihak lain yang mau bikin tampilan sendiri dari data ini.
 */
export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [granularity, setGranularity] = useState("daily");

  const { contacts, loading: contactsLoading } = useContacts();
  const { templates } = useTemplates();

  async function loadOverview(nextGranularity = granularity) {
    setStatus("loading");
    try {
      const data = await getAnalyticsOverviewApi(nextGranularity);
      setOverview(data);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message || "Gagal mengambil data analitik.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGranularityChange(next) {
    setGranularity(next);
    loadOverview(next);
  }

  const totalMessages = useMemo(
    () => (overview?.statusBreakdown ?? []).reduce((sum, row) => sum + row.count, 0),
    [overview]
  );

  const statusSlices = useMemo(
    () =>
      (overview?.statusBreakdown ?? []).map((row) => ({
        name: STATUS_LABELS[row.status] || row.status,
        value: row.count,
        color: STATUS_COLORS[row.status] || FALLBACK_COLOR,
      })),
    [overview]
  );

  const messageTrend = useMemo(
    () =>
      (overview?.messageTrend ?? []).map((row) => ({
        ...row,
        label: formatBucketLabel(row.date, granularity),
      })),
    [overview, granularity]
  );

  const contactGrowth = useMemo(
    () =>
      (overview?.contactGrowth ?? []).map((row) => ({
        ...row,
        label: formatBucketLabel(row.date, granularity),
      })),
    [overview, granularity]
  );

  const replySlices = useMemo(
    () =>
      (overview?.replyRatio ?? [])
        .filter((row) => row.count > 0)
        .map((row) => ({
          name: REPLY_LABELS[row.reply_status] || row.reply_status,
          value: row.count,
          color: REPLY_COLORS[row.reply_status] || FALLBACK_COLOR,
        })),
    [overview]
  );

  const templateUsage = overview?.templateUsage ?? [];

  const activeTemplateCount = useMemo(
    () => templates.filter((t) => !t.isDeleted).length,
    [templates]
  );

  return (
    <Layout>
      <PageHeader title="Dashboard" actionLabel="Segarkan" onAction={() => loadOverview()} />

      <div className="px-8 pb-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Ringkasan</h2>
            <p className="text-sm text-gray-400">Rangkuman & tren aktivitas WhatsApp dari waktu ke waktu.</p>
          </div>

          <div className="flex gap-1 rounded-full border border-gray-200 p-1">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleGranularityChange(option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  granularity === option.value ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard icon={MessageSquareText} label="Total Pesan (Semua Status)" value={totalMessages} loading={status === "loading"} />
          <SummaryCard icon={Users} label="Jumlah Nomor WhatsApp" value={contacts.length} loading={contactsLoading} />
          <SummaryCard icon={FileText} label="Jumlah Template" value={activeTemplateCount} loading={false} />
        </div>

        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <RefreshCw size={16} className="animate-spin" /> Memuat data...
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-red-500">{errorMessage} — pastikan backend sedang berjalan.</p>
        )}

        {status === "ready" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Tren Pengiriman Pesan" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={messageTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="terkirim" name="Terkirim" stroke={STATUS_COLORS.terkirim} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gagal" name="Gagal" stroke={STATUS_COLORS.gagal} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Status Pengiriman">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusSlices} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {statusSlices.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Rasio Balasan Approve/Reject">
              {replySlices.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={replySlices} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                      {replySlices.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Pemakaian per Template" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={Math.max(220, templateUsage.length * 40)}>
                <BarChart data={templateUsage} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="template_wa" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Jumlah Kirim" fill={TEMPLATE_BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Pertumbuhan Jumlah Kontak Baru" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={contactGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Kontak Baru" stroke="#1d6fe0" fill="#1d6fe0" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
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

function ChartCard({ title, className = "", children }) {
  return (
    <div className={`rounded-2xl border border-gray-100 p-6 ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChartNote() {
  return <p className="flex h-[260px] items-center justify-center text-sm text-gray-400">Belum ada data.</p>;
}
