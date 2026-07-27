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

export async function handleListTemplates(_req, res) {
  const data = await listTemplates();
  return res.status(200).json({ success: true, data });
}

export async function handleCreateTemplate(req, res) {
  const { name, body, require_reply } = req.body ?? {};

  const validationError = validateNameAndBody(name, body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

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

export async function handleDeactivateTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateActive(id, false);
  return res.status(200).json({ success: true, data: updated });
}

export async function handleActivateTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateActive(id, true);
  return res.status(200).json({ success: true, data: updated });
}

export async function handleSoftDeleteTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateDeleted(id, true);
  return res.status(200).json({ success: true, data: updated });
}

export async function handleRestoreTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  const updated = await setTemplateDeleted(id, false);
  return res.status(200).json({ success: true, data: updated });
}

export async function handleDeleteTemplate(req, res) {
  const { id } = req.params;
  const existingTemplate = await findTemplateById(id);
  if (!existingTemplate) {
    return res.status(404).json({ success: false, message: "Template tidak ditemukan." });
  }
  await deleteTemplateForever(id);
  return res.status(200).json({ success: true, message: "Template berhasil dihapus permanen." });
}
