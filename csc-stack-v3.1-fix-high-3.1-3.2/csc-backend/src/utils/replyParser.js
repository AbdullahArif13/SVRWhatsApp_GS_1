// Menentukan apakah body balasan user berarti "Approve" atau "Reject".
// Dipakai webhookController.js begitu ada balasan yang cocok
// (payload.replied_to_id) dengan salah satu kiriman di message_logs yang
// require_reply = true.

// Menentukan apakah body balasan user berarti "Approve" atau "Reject",
// DAN (khusus Reject) alasan opsional yang diketik setelahnya, mis.
// "Reject, karena maskernya ada yang rusak" -> reject + alasan
// "maskernya ada yang rusak". Reject TANPA alasan (cuma "Reject"/"N")
// tetap valid -- alasan sifatnya opsional, bukan wajib.
//
// Dipakai webhookController.js begitu ada balasan yang cocok
// (payload.replied_to_id) dengan salah satu kiriman di message_logs yang
// require_reply = true.

const APPROVE_WORDS = [
  "approve",
  "app",
  "approved",
  "setuju",
  "terima",
  "diterima",
  "ya",
  "yes",
  "ok",
  "oke",
  "y",
  "siap",
  "boleh",
  "sip",
];
const REJECT_WORDS = ["reject", "rejected", "tolak", "ditolak", "tidak", "no", "n"];

// Pemisah umum antara kata kunci Reject/Approve dengan alasannya, mis.
// "Reject, karena..." / "Reject: karena..." / "Reject - karena...".
const LEADING_SEPARATOR_REGEX = /^[\s,:;.\-]+/;
// "karena" di awal alasan sengaja dibuang juga, biar alasan yang
// ditampilkan ke user langsung isinya doang ("maskernya ada yang
// rusak"), bukan "karena maskernya ada yang rusak".
const LEADING_KARENA_REGEX = /^karena\s+/i;

/**
 * @param {string} text isi balasan mentah dari user
 * @returns {{ decision: "approve" | "reject" | null, reason: string | null }}
 *   decision null kalau balasannya bukan Approve/Reject yang valid sama
 *   sekali (user harus diminta mengetik ulang). reason SELALU null untuk
 *   Approve (alasan di belakang kata "Approve" sengaja diabaikan -- lihat
 *   catatan permintaan fitur ini, Approve dianggap aman apa pun alasannya).
 */
export function parseApproveReject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { decision: null, reason: null };

  // Coba exact match dulu -- balasan singkat TANPA alasan tambahan,
  // sama seperti perilaku sebelumnya (mis. cuma "Reject" atau "N").
  const normalizedExact = raw.toLowerCase().replace(/[.,!?]+$/, "");
  if (APPROVE_WORDS.includes(normalizedExact)) return { decision: "approve", reason: null };
  if (REJECT_WORDS.includes(normalizedExact)) return { decision: "reject", reason: null };

  // Bukan exact match -- cek apakah kalimatnya DIAWALI salah satu kata
  // kunci, sisanya dianggap alasan (kalau ada).
  const match = raw.match(/^(\S+)([\s\S]*)$/);
  if (!match) return { decision: null, reason: null };

  const [, firstWordRaw, restRaw] = match;
  const firstWord = firstWordRaw.toLowerCase().replace(/[.,!?:;]+$/, "");

  let decision = null;
  if (APPROVE_WORDS.includes(firstWord)) decision = "approve";
  else if (REJECT_WORDS.includes(firstWord)) decision = "reject";

  if (!decision) return { decision: null, reason: null };

  const reason = restRaw.replace(LEADING_SEPARATOR_REGEX, "").replace(LEADING_KARENA_REGEX, "").trim();

  return {
    decision,
    // Alasan cuma relevan buat Reject -- kalau Approve, apa pun yang
    // diketik setelahnya diabaikan (Approve dianggap aman tanpa syarat).
    reason: decision === "reject" && reason ? reason : null,
  };
}
