/**
 * Format tanggal/jam standar dashboard ini, contoh: "20 Jul 2026, 14.05".
 * Dulu ada 2 salinan logic yang sama persis (MessageHistory.jsx &
 * CreateTemplate.jsx) -- sekarang digabung jadi satu fungsi di sini.
 */
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
