import { listContacts, createContactManual } from "../data/contacts.js";

// Sama persis dengan pola di messageController.js, supaya nomor yang
// diterima di sini konsisten dengan yang divalidasi di /api/send-message.
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

/**
 * GET /api/contacts
 *
 * Semua kontak (terbaru duluan) -- gabungan yang otomatis kesimpen dari
 * POST /api/send-message (source: "send_message") dan yang di-add manual
 * lewat form "Add Contact" (source: "manual"). Dipakai dashboard supaya
 * daftar kontak tidak hilang tiap refresh, dan Chat.jsx bisa pilih nomor
 * tujuan dari kontak yang sudah pernah dipakai sistem lain juga.
 */
export async function handleListContacts(_req, res) {
  const data = await listContacts();
  return res.status(200).json({ success: true, data });
}

/**
 * POST /api/contacts
 *
 * Dipanggil dari form "Add Contact" di dashboard, buat nambah kontak
 * SECARA MANUAL (beda dengan yang otomatis kesimpen dari send-message).
 * Body: { "name": "<nama>", "phone": "<no_wa>" }
 */
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
    return res.status(201).json({ success: true, data: contact });
  } catch (error) {
    if (error.code === "DUPLICATE_CONTACT") {
      return res.status(409).json({ success: false, message: error.message });
    }
    throw error;
  }
}
