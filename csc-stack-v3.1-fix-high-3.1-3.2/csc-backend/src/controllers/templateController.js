import {
  findTemplateById,
  findAnyTemplateByName,
  listTemplates,
  createTemplate,
  updateTemplate,
  setTemplateActive,
  setTemplateDeleted,
  deleteTemplateForever,
} from "../data/templates.js";

// Nama template: huruf, angka, underscore, dash saja -- mencegah nama
// aneh-aneh (termasuk mencegah celah kalau suatu saat nama ini dipakai
// di tempat lain, mis. jadi nama file/key cache).
const TEMPLATE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

function validateNameAndBody(name, body) {
  if (!name || typeof name !== "string" || !name.trim()) {
    return "Field 'name' wajib diisi.";
  }
  if (!TEMPLATE_NAME_PATTERN.test(name.trim())) {
    return "Nama template hanya boleh huruf, angka, underscore, dan dash (maks 100 karakter).";
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return "Field 'body' wajib diisi.";
  }
  if (body.length > 4000) {
    return "Isi template maksimal 4000 karakter.";
  }
  return null;
}

/**
 * GET /api/templates
 *
 * Semua template (terbaru duluan). Dipakai FrontEnd untuk halaman
 * "Templates" dan picker template, gantiin data yang sebelumnya cuma
 * hidup di React state (hilang tiap refresh).
 */
export async function handleListTemplates(_req, res) {
  const data = await listTemplates();
  return res.status(200).json({ success: true, data });
}

/**
 * POST /api/templates
 *
 * Dipanggil dari halaman "Create Template" di FrontEnd. Body:
 *   { "name": "<nama_template>", "body": "<isi pesan dengan {{variabel}}>" }
 */
export async function handleCreateTemplate(req, res) {
  const { name, body, require_reply } = req.body ?? {};

  const validationError = validateNameAndBody(name, body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  // require_reply: parameter True/False. Kalau tidak dikirim sama sekali,
  // default-nya false (perilaku lama -- user tidak wajib membalas).
  if (require_reply !== undefined && typeof require_reply !== "boolean") {
    return res.status(400).json({ success: false, message: "Field 'require_reply' harus berupa true/false." });
  }

  const existing = await findAnyTemplateByName(name);
  if (existing) {
    return res.status(409).json({ success: false, message: `Template '${name}' sudah ada.` });
  }

  const template = await createTemplate({ name: name.trim(), body, requireReply: Boolean(require_reply) });
  return res.status(201).json({ success: true, data: template });
}

/**
 * PUT /api/templates/:id
 *
 * Dipanggil dari icon "Edit" (folder) di halaman Templates -- popup
 * dashboard_popup_tamplate. Body: { "name": "...", "body": "..." }
 */
export async function handleUpdateTemplate(req, res) {
  const { id } = req.params;
  const { name, body, require_reply } = req.body ?? {};

  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }

  const validationError = validateNameAndBody(name, body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  if (require_reply !== undefined && typeof require_reply !== "boolean") {
    return res.status(400).json({ success: false, message: "Field 'require_reply' harus berupa true/false." });
  }

  const nameTaken = await findAnyTemplateByName(name);
  if (nameTaken && String(nameTaken.id) !== String(id)) {
    return res.status(409).json({ success: false, message: `Template '${name}' sudah ada.` });
  }

  const updated = await updateTemplate(id, { name: name.trim(), body, requireReply: require_reply });
  return res.status(200).json({ success: true, data: updated });
}

/**
 * PATCH /api/templates/:id/deactivate
 *
 * Toggle status Aktif -> Nonaktif di TABEL Templates (klik langsung di
 * switch-nya). Baris TETAP tampil di tabel utama, TIDAK pindah ke panel
 * Database -- beda dengan handleSoftDeleteTemplate di bawah.
 */
export async function handleDeactivateTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateActive(id, false);
  return res.status(200).json({ success: true, data: updated });
}

/**
 * PATCH /api/templates/:id/activate
 *
 * Toggle status Nonaktif -> Aktif di TABEL Templates (klik langsung di
 * switch-nya).
 */
export async function handleActivateTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateActive(id, true);
  return res.status(200).json({ success: true, data: updated });
}

/**
 * PATCH /api/templates/:id/soft-delete
 *
 * Dipanggil dari icon tong sampah "Hapus" (di tabel maupun popup detail).
 * Template PINDAH dari tabel utama ke panel "Database" -- baris-nya TIDAK
 * hilang dari database, cuma disembunyikan sampai di-restore lagi.
 */
export async function handleSoftDeleteTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateDeleted(id, true);
  return res.status(200).json({ success: true, data: updated });
}

/**
 * PATCH /api/templates/:id/restore
 *
 * Tombol "Gunakan Kembali" di panel Database -- kembalikan template dari
 * Database ke tabel utama lagi (statusnya balik Aktif, sesuai perilaku
 * lama).
 */
export async function handleRestoreTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateDeleted(id, false);
  return res.status(200).json({ success: true, data: updated });
}

/**
 * DELETE /api/templates/:id
 *
 * Tombol "Delete" DI DALAM popup detail template (dashboard_popup_tamplate)
 * -- ini yang benar-benar menghapus baris dari database secara permanen.
 * Beda dengan handleDeactivateTemplate (icon trash di tabel), yang cuma
 * non-aktifkan.
 */
export async function handleDeleteTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  await deleteTemplateForever(id);
  return res.status(200).json({ success: true, message: "Template berhasil dihapus permanen." });
}
