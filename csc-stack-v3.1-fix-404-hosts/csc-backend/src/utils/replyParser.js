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
const LEADING_SEPARATOR_REGEX = /^[\s,:;.\-]+/;
const LEADING_KARENA_REGEX = /^karena\s+/i;

export function parseApproveReject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { decision: null, reason: null };

  
  
  const normalizedExact = raw.toLowerCase().replace(/[.,!?]+$/, "");
  if (APPROVE_WORDS.includes(normalizedExact)) return { decision: "approve", reason: null };
  if (REJECT_WORDS.includes(normalizedExact)) return { decision: "reject", reason: null };

  
  
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
    
    
    reason: decision === "reject" && reason ? reason : null,
  };
}
