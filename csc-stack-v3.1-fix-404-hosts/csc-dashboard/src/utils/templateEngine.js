// Logic ini SENGAJA dibuat identik dengan `src/utils/templateEngine.js` di
// backend (csc-dashboard-backend), supaya preview yang tampil di frontend
// selalu sama persis dengan pesan yang benar-benar dikirim lewat backend.

/**
 * Menemukan semua {{variabel}} unik di dalam teks, urut sesuai kemunculan
 * pertama. Spasi di dalam kurung ditoleransi, mis. {{ nama }} tetap
 * dianggap variabel "nama".
 */
export function extractVariableNames(text) {
  const seen = new Set();
  const names = [];
  for (const match of String(text ?? "").matchAll(/{{\s*([\w]+)\s*}}/g)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Replaces {{variabel}} placeholders in a template body with entered values. */
export function fillTemplate(text, values = {}) {
  return String(text ?? "").replace(/{{\s*([\w]+)\s*}}/g, (match, key) => {
    const value = values[key];
    return value ? value : match;
  });
}

// Harus SAMA PERSIS dengan REQUIRE_REPLY_INSTRUCTION di backend
// (csc-backend/src/utils/templateEngine.js), supaya preview yang tampil
// di sini (Create Template / Edit Template) selalu cocok dengan pesan
// yang benar-benar dikirim backend saat template.require_reply = true.
export const REQUIRE_REPLY_INSTRUCTION =
  'Silakan balas pesan ini dengan mengetik "Approve" atau "Reject".';

/**
 * Isi {{variabel}} di body, LALU tambahkan kalimat instruksi Approve/Reject
 * di akhir kalau `requireReply` true -- dipakai untuk preview supaya user
 * langsung lihat kalimat itu otomatis muncul begitu toggle dinyalakan,
 * tanpa perlu diketik manual di Body Message.
 */
export function buildFinalMessage(body, values = {}, requireReply = false) {
  const filled = fillTemplate(body, values);
  if (!requireReply) return filled;
  return `${filled}\n\n${REQUIRE_REPLY_INSTRUCTION}`;
}

/**
 * Nama variabel yang wajib diisi tapi masih kosong di `values`.
 * Dipakai untuk menonaktifkan tombol "Kirim" sebelum data lengkap,
 * sebelum request sempat ditolak oleh backend.
 */
export function findMissingVariables(templateBody, values = {}) {
  return extractVariableNames(templateBody).filter((name) => !values[name]?.trim());
}