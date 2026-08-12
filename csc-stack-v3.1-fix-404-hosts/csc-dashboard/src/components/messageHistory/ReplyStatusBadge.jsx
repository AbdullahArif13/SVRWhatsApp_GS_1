
export default function ReplyStatusBadge({ replyStatus, onClick }) {
  if (!replyStatus || replyStatus === "tidak_diperlukan") {
    return <span className="text-gray-400">-</span>;
  }
  const styleByStatus = {
    menunggu: "bg-yellow-100 text-yellow-700",
    approve: "bg-green-100 text-green-600",
    reject: "bg-red-100 text-red-500",
  };
  const labelByStatus = {
    menunggu: "Menunggu Balasan",
    approve: "Approve",
    reject: "Reject",
  };
  const className = `rounded-full px-3 py-1 text-xs font-semibold ${
    styleByStatus[replyStatus] ?? "bg-gray-100 text-gray-500"
  }`;

  if (replyStatus === "reject" && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Lihat alasan Reject"
        className={`${className} underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80`}
      >
        {labelByStatus.reject}
      </button>
    );
  }

  return <span className={className}>{labelByStatus[replyStatus] ?? replyStatus}</span>;
}
