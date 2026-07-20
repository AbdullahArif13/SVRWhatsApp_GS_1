export default function RequireReplyBadge({ requireReply }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        requireReply ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {requireReply ? "Respons Aktif" : "Respons Nonaktif"}
    </span>
  );
}
