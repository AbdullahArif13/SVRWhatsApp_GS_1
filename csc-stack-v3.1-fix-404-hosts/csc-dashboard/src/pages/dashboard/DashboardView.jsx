import { RefreshCw } from "lucide-react";
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
import Layout from "../../components/Layout.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import FilterSelect from "../../components/FilterSelect.jsx";
import { MessageSquareText, Users, FileText } from "lucide-react";

export default function DashboardView({
  status,
  errorMessage,
  loadOverview,
  granularity,
  selectedDay,
  selectedMonth,
  selectedYear,
  handleGranularityChange,
  handleDayChange,
  handleMonthChange,
  handleYearChange,
  contactsLoading,
  contactsCount,
  totalMessages,
  statusSlices,
  messageTrend,
  contactGrowth,
  replySlices,
  templateUsage,
  scopeLabel,
  xAxisTickInterval,
  activeTemplateCount,
  overviewReady,
  granularityOptions,
  monthOptions,
  yearOptions,
  todayIso,
  monthStartIso,
}) {
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
              {granularityOptions.map((option) => (
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
              <FilterSelect options={monthOptions} value={selectedMonth} onChange={handleMonthChange} />
            )}
            {granularity === "yearly" && (
              <FilterSelect options={yearOptions} value={selectedYear} onChange={handleYearChange} />
            )}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard icon={MessageSquareText} label="Total Pesan (Semua Status)" value={totalMessages} loading={status === "loading"} />
          <SummaryCard icon={Users} label="Jumlah Nomor WhatsApp" value={contactsCount} loading={contactsLoading} />
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

        {overviewReady && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Tren Pengiriman Pesan" subtitle={scopeLabel} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={messageTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={xAxisTickInterval} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="terkirim" name="Terkirim" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gagal" name="Gagal" stroke="#ef4444" strokeWidth={2} dot={false} />
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
                    <Bar dataKey="count" name="Jumlah Kirim" fill="#1d6fe0" radius={[0, 4, 4, 0]} />
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
