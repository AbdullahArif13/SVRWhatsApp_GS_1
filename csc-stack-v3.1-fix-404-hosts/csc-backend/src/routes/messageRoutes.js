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
const requireEditor = requireRole("super_admin", "admin", "pengguna");

router.post("/send-message", enqueueLimiter, uploadPhoto.single("foto"), asyncHandler(handleSendMessage));
router.get("/contacts", asyncHandler(handleListContacts));
router.post("/contacts", requireEditor, asyncHandler(handleCreateContact));
router.get("/messages", handleListMessages);
router.get("/messages/:id", asyncHandler(handleGetMessageStatus));
router.get("/templates", asyncHandler(handleListTemplates));
router.post("/templates", requireEditor, asyncHandler(handleCreateTemplate));
router.get("/templates/:name/variables", asyncHandler(handleGetTemplateVariables));
router.put("/templates/:id", requireEditor, asyncHandler(handleUpdateTemplate));
router.patch("/templates/:id/deactivate", requireEditor, asyncHandler(handleDeactivateTemplate));
router.patch("/templates/:id/activate", requireEditor, asyncHandler(handleActivateTemplate));
router.patch("/templates/:id/soft-delete", requireEditor, asyncHandler(handleSoftDeleteTemplate));
router.patch("/templates/:id/restore", requireEditor, asyncHandler(handleRestoreTemplate));
router.delete("/templates/:id", requireEditor, asyncHandler(handleDeleteTemplate));

export default router;
