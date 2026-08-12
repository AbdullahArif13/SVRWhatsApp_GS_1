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
import FilterSelect from "../components/FilterSelect.jsx";
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

const MONTH_OPTIONS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const CURRENT_YEAR = new Date().getUTCFullYear();
// Dropdown tahun: 5 tahun ke belakang dari tahun berjalan sampai tahun berjalan.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const year = CURRENT_YEAR - i;
  return { value: String(year), label: String(year) };
});

// v3.14: FIX -- backend (services/analytics.js) SEKARANG menghitung semua
// bucket/rentang tanggal eksplisit dalam WIB (UTC+7), bukan UTC lagi
// (sebelumnya ini yang bikin jam di "Tren Pengiriman Pesan" & "Pertumbuhan
// Kontak Baru" geser 7 jam dari jam yang sama persis ditampilkan di
// "Riwayat Pengiriman"). Di FrontEnd, dua tempat SEPERTI INI juga perlu
// konsisten pakai WIB, bukan `getUTC*()`/`timeZone: "UTC"` mentah:
//   - Helper tanggal hari ini/awal bulan (buat default & batas date-picker
//     "Harian") sekarang pakai jam LOKAL BROWSER (bukan UTC) -- asumsinya
//     dashboard ini dibuka dari browser yang memang di-set WIB (sama
//     seperti utils/formatDate.js dipakai di Riwayat Pengiriman/halaman
//     lain, yang juga pakai jam lokal browser lewat toLocaleString).
//   - formatBucketLabel() di bawah menggeser instant UTC dari backend
//     +7 jam lebih dulu, BARU dibaca field UTC-nya sebagai jam-dinding WIB
//     -- ini SENGAJA tidak ikut jam lokal browser (beda dari poin di
//     atas), supaya grafik selalu tampil WIB apa pun timezone OS
//     browsernya (jaga-jaga kalau ada laptop yang salah setting).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO date (YYYY-MM-DD) hari ini, basis WAKTU LOKAL BROWSER -- dipakai
 *  sebagai default & batas atas date-picker "Harian". */
function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO date (YYYY-MM-DD) tanggal 1 bulan berjalan (basis waktu lokal
 *  browser) -- batas bawah date-picker "Harian", supaya user cuma bisa
 *  milih tanggal DI BULAN INI (gak nyebrang ke bulan/tahun lain). */
function monthStartIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Format label sumbu-X grafik tren sesuai granularity yang dipilih:
 *   - daily   : jam:menit slot 30 menit-an WIB, misal "08.30" (tanggal pilihan)
 *   - monthly : nama hari + tanggal, misal "Sen, 1" (bulan yang dipilih)
 *   - yearly  : nama bulan singkat, misal "Jan" (tahun yang dipilih)
 */
function formatBucketLabel(isoDate, granularity) {
  // Geser +7 jam dulu, baru baca field UTC-nya sebagai jam-dinding WIB --
  // lihat catatan WIB_OFFSET_MS di atas.
  const date = new Date(new Date(isoDate).getTime() + WIB_OFFSET_MS);
  if (granularity === "yearly") return date.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" });
  if (granularity === "monthly") {
    return date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", timeZone: "UTC" });
  }
  // daily
  const hh = date.getUTCHours().toString().padStart(2, "0");
  const mm = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}.${mm}`;
}

/**
 * v3.13: Dashboard analitik interaktif -- dipakai SEMUA role (termasuk
 * 'pengguna'/read-only, yang cuma boleh akses halaman ini). Datanya dari
 * GET /api/analytics/overview (lihat services/api.js) -- endpoint yang
 * SAMA juga bisa dipakai integrasi eksternal lewat X-API-Key kalau nanti
 * ada pihak lain yang mau bikin tampilan sendiri dari data ini.
 *
 * SEMUA grafik (Tren, Status Pengiriman, Rasio Balasan, Pemakaian per
 * Template, Pertumbuhan Kontak) ikut skop harian(tanggal pilihan) /
 * bulanan(bulan pilihan) / tahunan(tahun pilihan) yang sama -- summary
 * card di atas (Total Pesan, Jumlah Nomor, Jumlah Template) TETAP
 * sepanjang masa, gak kepengaruh granularity.
 */
export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [granularity, setGranularity] = useState("daily");
  // Dipakai pas granularity = "daily" (date-picker, default hari ini, dikunci
  // cuma boleh tanggal di bulan berjalan -- lihat min/max di <input type="date">).
  const [selectedDay, setSelectedDay] = useState(todayIso());
  // Dipakai pas granularity = "monthly" (dropdown Januari-Desember, default bulan berjalan).
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getUTCMonth() + 1));
  // Dipakai pas granularity = "yearly" (dropdown tahun, default tahun berjalan).
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));

  const { contacts, loading: contactsLoading } = useContacts();
  const { templates } = useTemplates();

  async function loadOverview(
    nextGranularity = granularity,
    nextDay = selectedDay,
    nextMonth = selectedMonth,
    nextYear = selectedYear
  ) {
    setStatus("loading");
    try {
      const data = await getAnalyticsOverviewApi(nextGranularity, { day: nextDay, month: nextMonth, year: nextYear });
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
    loadOverview(next, selectedDay, selectedMonth, selectedYear);
  }

  function handleDayChange(next) {
    setSelectedDay(next);
    loadOverview(granularity, next, selectedMonth, selectedYear);
  }

  function handleMonthChange(next) {
    setSelectedMonth(next);
    loadOverview(granularity, selectedDay, next, selectedYear);
  }

  function handleYearChange(next) {
    setSelectedYear(next);
    loadOverview(granularity, selectedDay, selectedMonth, next);
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

  // Caption kecil di atas grafik, biar jelas skop waktu yang lagi
  // ditampilkan (tanggal pilihan / bulan+tahun pilihan / tahun pilihan).
  const scopeLabel = useMemo(() => {
    if (granularity === "daily") {
      return new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    if (granularity === "monthly") {
      const monthLabel = MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label ?? "";
      return `${monthLabel} ${selectedYear}`;
    }
    return selectedYear;
  }, [granularity, selectedDay, selectedMonth, selectedYear]);

  // Grafik "Tren Pengiriman Pesan" & "Pertumbuhan Kontak" punya titik yang
  // beda-beda banyaknya (48 titik pas daily, sampai 31 titik pas monthly,
  // 12 titik pas yearly) -- interval dibikin dinamis biar label sumbu-X
  // gak numpuk pas daily.
  const xAxisTickInterval = granularity === "daily" ? 3 : 0;

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

          <div className="flex items-center gap-3">
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

            {granularity === "daily" && (
              <input
                type="date"
                value={selectedDay}
                min={monthStartIso()}
                max={todayIso()}
                onChange={(e) => handleDayChange(e.target.value)}
                className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-brand-hover [color-scheme:dark]"
              />
            )}
            {granularity === "monthly" && (
              <FilterSelect options={MONTH_OPTIONS} value={selectedMonth} onChange={handleMonthChange} />
            )}
            {granularity === "yearly" && (
              <FilterSelect options={YEAR_OPTIONS} value={selectedYear} onChange={handleYearChange} />
            )}
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
            <ChartCard title="Tren Pengiriman Pesan" subtitle={scopeLabel} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={messageTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={xAxisTickInterval} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="terkirim" name="Terkirim" stroke={STATUS_COLORS.terkirim} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gagal" name="Gagal" stroke={STATUS_COLORS.gagal} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Status Pengiriman" subtitle={scopeLabel}>
              {statusSlices.length === 0 ? (
                <EmptyChartNote />
              ) : (
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
              )}
            </ChartCard>

            <ChartCard title="Rasio Balasan Approve/Reject" subtitle={scopeLabel}>
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

            <ChartCard title="Pemakaian per Template" subtitle={scopeLabel} className="lg:col-span-2">
              {templateUsage.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, templateUsage.length * 40)}>
                  <BarChart data={templateUsage} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="template_wa" width={180} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Jumlah Kirim" fill={TEMPLATE_BAR_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Pertumbuhan Jumlah Kontak Baru" subtitle={scopeLabel} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={contactGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={xAxisTickInterval} />
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

function ChartCard({ title, subtitle, className = "", children }) {
  return (
    <div className={`rounded-2xl border border-gray-100 p-6 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <span className="text-xs font-medium text-gray-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyChartNote() {
  return <p className="flex h-[260px] items-center justify-center text-sm text-gray-400">Belum ada data.</p>;
}