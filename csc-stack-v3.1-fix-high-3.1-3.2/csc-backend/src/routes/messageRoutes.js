import { Router } from "express";
import {
  handleSendMessage,
  handleGetTemplateVariables,
  handleListMessages,
  handleListTemplates,
  handleCreateTemplate,
  handleUpdateTemplate,
  handleDeactivateTemplate,
  handleActivateTemplate,
  handleDeleteTemplate,
} from "../controllers/messageController.js";
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

// v3: edit + hapus template dari dashboard_tamplate.
// - PUT    /templates/:id             -> edit nama/body (icon folder)
// - PATCH  /templates/:id/deactivate  -> "hapus" ringan / non-aktifkan (icon trash di tabel)
// - PATCH  /templates/:id/activate    -> tombol "Continuous" di popup detail (restore)
// - DELETE /templates/:id             -> tombol "Delete" DI DALAM popup detail (hapus permanen)
router.put("/templates/:id", asyncHandler(handleUpdateTemplate));
router.patch("/templates/:id/deactivate", asyncHandler(handleDeactivateTemplate));
router.patch("/templates/:id/activate", asyncHandler(handleActivateTemplate));
router.delete("/templates/:id", asyncHandler(handleDeleteTemplate));

export default router;
