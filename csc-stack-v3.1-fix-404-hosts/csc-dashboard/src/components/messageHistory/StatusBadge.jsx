


const STYLES = {
  terkirim: "bg-green-100 text-green-600",
  gagal: "bg-red-100 text-red-500",
  antri: "bg-amber-100 text-amber-600",
};
const LABELS = {
  terkirim: "Terkirim",
  gagal: "Gagal",
  antri: "Antri",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || "bg-gray-100 text-gray-500";
  const label = LABELS[status] || status;
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
