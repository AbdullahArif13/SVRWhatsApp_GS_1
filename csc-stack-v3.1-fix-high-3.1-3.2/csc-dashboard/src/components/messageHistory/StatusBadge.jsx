export default function StatusBadge({ status }) {
  const isSent = status === "terkirim";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isSent ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
      }`}
    >
      {isSent ? "Terkirim" : "Gagal"}
    </span>
  );
}
