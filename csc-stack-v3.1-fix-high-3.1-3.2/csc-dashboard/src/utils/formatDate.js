export function formatTimestamp(isoStringOrDate) {
  if (!isoStringOrDate) return "-";
  return new Date(isoStringOrDate).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
