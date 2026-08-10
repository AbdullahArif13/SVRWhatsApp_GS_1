import { Router } from "express";
import {
  handleSendMessage,
  handleGetTemplateVariables,
  handleListMessages,
  handleGetMessageStatus,
} from "../controllers/messageController.js";
import {
  handleListTemplates,
  handleCreateTemplate,
  handleUpdateTemplate,
  handleDeactivateTemplate,
  handleActivateTemplate,
  handleSoftDeleteTemplate,
  handleRestoreTemplate,
  handleDeleteTemplate,
} from "../controllers/templateController.js";
import { handleListContacts, handleCreateContact } from "../controllers/contactController.js";
import { enqueueLimiter } from "../middleware/rateLimiter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadPhoto } from "../middleware/uploadPhoto.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// v3.12: gerbang role KHUSUS untuk aksi TULIS yang memang dashboard-only
// (Create/Edit/Hapus Template lewat UI, Add Contact manual) -- supaya
// activity log (lihat templateController.js/contactController.js) SELALU
// punya actor yang jelas (siapa yang login). 'pengguna' TERMASUK di sini
// (dia operator biasa -- boleh Tambah Kontak & Tambah Template, itulah
// yang bikin aktivitasnya perlu dipantau lewat Manage User) -- yang
// dikecualikan cuma 'read_only' (BENERAN read-only, cuma boleh Dashboard).
// SENGAJA TIDAK dipasang di GET */send-message/messages -- endpoint itu
// juga dipanggil integrasi eksternal murni lewat X-API-Key TANPA sesi
// login sama sekali.
const requireEditor = requireRole("super_admin", "admin", "pengguna");

// v3.8: "foto" sekarang bisa dikirim 2 cara --
//   1. JSON biasa (Content-Type: application/json), values.foto berisi URL
//      gambar -- perilaku LAMA, tidak berubah sama sekali.
//   2. multipart/form-data, field "foto" berisi file JPG/PNG langsung --
//      uploadPhoto.single("foto") DI SINI cuma aktif kalau Content-Type-nya
//      memang multipart; untuk request JSON biasa middleware ini langsung
//      next() tanpa mengubah apa-apa (lihat uploadPhoto.js & handleSendMessage
//      untuk percabangan dua alur ini).
router.post("/send-message", enqueueLimiter, uploadPhoto.single("foto"), asyncHandler(handleSendMessage));

// v3: kontak. GET dipakai dashboard buat isi halaman Add Contact / picker
// nomor tujuan di Chat. POST dipakai form "Add Contact" (manual) --
// kontak dari /send-message tersimpan otomatis, tidak lewat endpoint ini.
router.get("/contacts", asyncHandler(handleListContacts));
router.post("/contacts", requireEditor, asyncHandler(handleCreateContact));
router.get("/messages", handleListMessages);
// v3.4: polling status satu pesan (dipakai sistem eksternal buat ngecek
// hasil akhir dari POST /send-message yang tadinya cuma masuk antrian).
router.get("/messages/:id", asyncHandler(handleGetMessageStatus));
router.get("/templates", asyncHandler(handleListTemplates));
router.post("/templates", requireEditor, asyncHandler(handleCreateTemplate));
router.get("/templates/:name/variables", asyncHandler(handleGetTemplateVariables));

// v3.3: edit + status (Aktif/Nonaktif/Dihapus) template dari dashboard_tamplate.
// - PUT    /templates/:id             -> edit nama/body (icon folder)
// - PATCH  /templates/:id/deactivate  -> toggle Aktif -> Nonaktif (switch di tabel, TETAP tampil)
// - PATCH  /templates/:id/activate    -> toggle Nonaktif -> Aktif (switch di tabel)
// - PATCH  /templates/:id/soft-delete -> "Hapus" (icon trash) -- pindah ke panel Database
// - PATCH  /templates/:id/restore     -> "Gunakan Kembali" di panel Database
// - DELETE /templates/:id             -> hapus permanen (TIDAK dipakai dari UI manapun saat ini)
router.put("/templates/:id", requireEditor, asyncHandler(handleUpdateTemplate));
router.patch("/templates/:id/deactivate", requireEditor, asyncHandler(handleDeactivateTemplate));
router.patch("/templates/:id/activate", requireEditor, asyncHandler(handleActivateTemplate));
router.patch("/templates/:id/soft-delete", requireEditor, asyncHandler(handleSoftDeleteTemplate));
router.patch("/templates/:id/restore", requireEditor, asyncHandler(handleRestoreTemplate));
router.delete("/templates/:id", requireEditor, asyncHandler(handleDeleteTemplate));

export default router;
