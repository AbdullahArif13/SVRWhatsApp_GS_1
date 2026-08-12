import { listContacts, createContactManual } from "../data/contacts.js";
import { logActivity, actorFromRequest } from "../data/activityLogs.js";

const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

export async function handleListContacts(_req, res) {
  const data = await listContacts();
  return res.status(200).json({ success: true, data });
}


export async function handleCreateContact(req, res) {
  const { name, phone } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ success: false, message: "Field 'name' wajib diisi." });
  }
  if (name.length > 255) {
    return res.status(400).json({ success: false, message: "Field 'name' terlalu panjang." });
  }
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ success: false, message: "Field 'phone' wajib diisi." });
  }
  const cleanedPhone = phone.replace(/[\s()-]/g, "");
  if (!PHONE_PATTERN.test(cleanedPhone)) {
    return res.status(400).json({ success: false, message: "Format 'phone' tidak valid." });
  }

  try {
    const contact = await createContactManual({ no_wa: cleanedPhone, nama_wa: name.trim() });
    logActivity({
      actor: actorFromRequest(req),
      action: "create",
      entityType: "contact",
      entityId: contact.id,
      detail: { no_wa: contact.no_wa, nama_wa: contact.nama_wa },
    });
    return res.status(201).json({ success: true, data: contact });
  } catch (error) {
    if (error.code === "DUPLICATE_CONTACT") {
      return res.status(409).json({ success: false, message: error.message });
    }
    throw error;
  }
}
