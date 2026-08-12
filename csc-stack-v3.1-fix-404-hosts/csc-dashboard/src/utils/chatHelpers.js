export function previewText(log) {
  if (!log) return "";
  return log.final_message?.split("\n")[0] ?? "";
}

export function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} Min`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} Jam`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} Hari`;
}

export function formatDateDivider(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
