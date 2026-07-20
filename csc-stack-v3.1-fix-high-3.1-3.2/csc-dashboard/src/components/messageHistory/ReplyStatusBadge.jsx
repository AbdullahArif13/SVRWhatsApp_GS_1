/**
 * v3.2: status balasan Approve/Reject.
 *  - "tidak_diperlukan" : template ini require_reply = false -> tidak ada badge/"-".
 *  - "menunggu"          : require_reply = true, belum ada balasan valid.
 *  - "approve" / "reject": user sudah membalas dengan kata yang valid.
 */
export default function ReplyStatusBadge({ replyStatus }) {
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
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styleByStatus[replyStatus] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {labelByStatus[replyStatus] ?? replyStatus}
    </span>
  );
}
