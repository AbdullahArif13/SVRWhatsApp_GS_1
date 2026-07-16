// Logic ini SENGAJA dibuat identik dengan `extractVariableNames` dan
// `fillTemplate` di frontend (src/pages/CreateTemplate.jsx), supaya
// preview di Create Template dan hasil kirim WA di backend selalu konsisten.

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

/**
 * Mengganti setiap {{variabel}} di dalam teks dengan value dari `values`.
 * `values` adalah object dinamis, key-nya bisa apa saja tergantung template
 * (mis. { Nama: "...", Nomor: "..." } untuk template A, atau
 * { nama: "...", lokasi: "...", jam: "..." } untuk template B).
 *
 * Pencocokan key dibuat case-insensitive supaya toleran terhadap perbedaan
 * huruf besar/kecil antara nama variabel di body template vs payload
 * request (mis. {{Nama_Requester}} di body vs "Nama_Rquester" di payload).
 */
export function fillTemplate(text, values = {}) {
  const lowerCaseValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );

  return String(text ?? "").replace(/{{\s*([\w]+)\s*}}/g, (match, key) => {
    const value = lowerCaseValues[key.toLowerCase()];
    return value !== undefined && value !== null && value !== "" ? String(value) : match;
  });
}

// Kalimat instruksi Approve/Reject -- SATU-SATUNYA tempat teks ini
// didefinisikan. Dulu teks ini harus diketik manual di Body Message tiap
// template (contoh lama: template "spct_order"), jadi kalau toggle
// "Wajib Balas Approve/Reject?" dinyalakan di template LAIN, pesan yang
// terkirim tidak otomatis menyuruh user membalas apa-apa -- padahal
// sistem sudah "mewajibkan" balasan itu (require_reply = true di DB).
//
// Sekarang perilakunya konsisten: SIAPA PUN yang menyalakan toggle ini
// (baik saat create template baru maupun edit template lama), kalimat
// ini otomatis ditambahkan ke akhir pesan yang dikirim -- tidak perlu
// diketik manual lagi di Body Message.
export const REQUIRE_REPLY_INSTRUCTION =
  'Silakan balas pesan ini dengan mengetik "Approve" atau "Reject".';

/**
 * Mengisi {{variabel}} di body template dengan `values`, LALU menambahkan
 * kalimat instruksi Approve/Reject di akhir pesan kalau `requireReply`
 * true. Inilah fungsi yang seharusnya dipakai untuk membentuk pesan FINAL
 * yang benar-benar dikirim ke WhatsApp (bukan `fillTemplate` polos),
 * supaya perilaku toggle "Wajib Balas Approve/Reject?" konsisten di semua
 * template -- tidak lagi tergantung apakah kalimat itu diketik manual di
 * body atau tidak.
 */
export function buildFinalMessage(body, values = {}, requireReply = false) {
  const filled = fillTemplate(body, values);
  if (!requireReply) return filled;
  return `${filled}\n\n${REQUIRE_REPLY_INSTRUCTION}`;
}

/**
 * Mengecek apakah semua {{variabel}} yang dibutuhkan template sudah ada
 * isinya di `values`. Mengembalikan daftar nama variabel yang MASIH KOSONG,
 * supaya endpoint bisa menolak request dengan pesan error yang jelas,
 * alih-alih mengirim pesan WA yang isinya masih ada "{{...}}" mentah.
 */
export function findMissingVariables(templateBody, values = {}) {
  const required = extractVariableNames(templateBody);
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );

  return required.filter((name) => {
    const value = normalized[name.toLowerCase()];
    return value === undefined || value === null || value === "";
  });
}