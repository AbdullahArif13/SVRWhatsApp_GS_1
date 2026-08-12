import { useEffect, useMemo, useState } from "react";
import { useContacts } from "../../context/ContactsContext.jsx";
import { useTemplates } from "../../context/TemplatesContext.jsx";
import { getAnalyticsOverviewApi } from "../../services/api.js";

const CURRENT_YEAR = new Date().getUTCFullYear();
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

const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const year = CURRENT_YEAR - i;
  return { value: String(year), label: String(year) };
});

const STATUS_COLORS = { terkirim: "#22c55e", gagal: "#ef4444", antri: "#f59e0b" };
const STATUS_LABELS = { terkirim: "Terkirim", gagal: "Gagal", antri: "Antri" };
const REPLY_COLORS = { approve: "#22c55e", reject: "#ef4444", menunggu: "#f59e0b", tidak_diperlukan: "#9ca3af" };
const REPLY_LABELS = { approve: "Approve", reject: "Reject", menunggu: "Menunggu", tidak_diperlukan: "Tidak Diperlukan" };
const FALLBACK_COLOR = "#9ca3af";
const TEMPLATE_BAR_COLOR = "#1d6fe0";

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStartIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function formatBucketLabel(isoDate, granularity) {
  const date = new Date(new Date(isoDate).getTime() + 7 * 60 * 60 * 1000);
  if (granularity === "yearly") return date.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" });
  if (granularity === "monthly") {
    return date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", timeZone: "UTC" });
  }
  const hh = date.getUTCHours().toString().padStart(2, "0");
  const mm = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}.${mm}`;
}

export function useDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [granularity, setGranularity] = useState("daily");
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getUTCMonth() + 1));
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

  const xAxisTickInterval = granularity === "daily" ? 3 : 0;
  const activeTemplateCount = useMemo(() => templates.filter((t) => !t.isDeleted).length, [templates]);

  return {
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
    contactsCount: contacts.length,
    totalMessages,
    statusSlices,
    messageTrend,
    contactGrowth,
    replySlices,
    templateUsage,
    scopeLabel,
    xAxisTickInterval,
    activeTemplateCount,
    overviewReady: status === "ready",
    granularityOptions: GRANULARITY_OPTIONS,
    monthOptions: MONTH_OPTIONS,
    yearOptions: YEAR_OPTIONS,
    todayIso,
    monthStartIso,
  };
}
