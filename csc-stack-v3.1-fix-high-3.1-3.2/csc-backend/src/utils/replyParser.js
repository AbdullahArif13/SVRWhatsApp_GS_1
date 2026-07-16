// Menentukan apakah body balasan user berarti "Approve" atau "Reject".
// Dipakai webhookController.js begitu ada balasan yang cocok
// (payload.replied_to_id) dengan salah satu kiriman di message_logs yang
// require_reply = true.

const APPROVE_WORDS = ["approve", "approved", "setuju", "terima", "diterima", "ya", "yes", "ok", "oke"];
const REJECT_WORDS = ["reject", "rejected", "tolak", "ditolak", "tidak", "no"];

/**
 * @param {string} text isi balasan mentah dari user
 * @returns {"approve" | "reject" | null} null kalau balasannya bukan
 *   Approve/Reject yang valid (user harus diminta mengetik ulang).
 */
export function parseApproveReject(text) {
  const normalized = String(text ?? "")
    .trim()
    .toLowerCase()
    // buang tanda baca umum di ujung kalimat spt "Approve." / "Reject!"
    .replace(/[.,!?]+$/, "");

  if (!normalized) return null;

  if (APPROVE_WORDS.includes(normalized)) return "approve";
  if (REJECT_WORDS.includes(normalized)) return "reject";

  return null;
}
