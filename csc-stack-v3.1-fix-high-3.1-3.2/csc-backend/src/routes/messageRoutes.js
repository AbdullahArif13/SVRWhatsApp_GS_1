import { Router } from "express";
import {
  handleSendMessage,
  handleGetTemplateVariables,
  handleListMessages,
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
import { sendMessageLimiter } from "../middleware/rateLimiter.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/send-message", sendMessageLimiter, asyncHandler(handleSendMessage));

// v3: kontak. GET dipakai dashboard buat isi halaman Add Contact / picker
// nomor tujuan di Chat. POST dipakai form "Add Contact" (manual) --
// kontak dari /send-message tersimpan otomatis, tidak lewat endpoint ini.
router.get("/contacts", asyncHandler(handleListContacts));
router.post("/contacts", asyncHandler(handleCreateContact));
router.get("/messages", handleListMessages);
router.get("/templates", asyncHandler(handleListTemplates));
router.post("/templates", asyncHandler(handleCreateTemplate));
router.get("/templates/:name/variables", asyncHandler(handleGetTemplateVariables));

// v3.3: edit + status (Aktif/Nonaktif/Dihapus) template dari dashboard_tamplate.
// - PUT    /templates/:id             -> edit nama/body (icon folder)
// - PATCH  /templates/:id/deactivate  -> toggle Aktif -> Nonaktif (switch di tabel, TETAP tampil)
// - PATCH  /templates/:id/activate    -> toggle Nonaktif -> Aktif (switch di tabel)
// - PATCH  /templates/:id/soft-delete -> "Hapus" (icon trash) -- pindah ke panel Database
// - PATCH  /templates/:id/restore     -> "Gunakan Kembali" di panel Database
// - DELETE /templates/:id             -> hapus permanen (TIDAK dipakai dari UI manapun saat ini)
router.put("/templates/:id", asyncHandler(handleUpdateTemplate));
router.patch("/templates/:id/deactivate", asyncHandler(handleDeactivateTemplate));
router.patch("/templates/:id/activate", asyncHandler(handleActivateTemplate));
router.patch("/templates/:id/soft-delete", asyncHandler(handleSoftDeleteTemplate));
router.patch("/templates/:id/restore", asyncHandler(handleRestoreTemplate));
router.delete("/templates/:id", asyncHandler(handleDeleteTemplate));

export default router;
