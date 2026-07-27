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

const router = Router();

router.post("/send-message", enqueueLimiter, asyncHandler(handleSendMessage));
router.get("/contacts", asyncHandler(handleListContacts));
router.post("/contacts", asyncHandler(handleCreateContact));
router.get("/messages", handleListMessages);
router.get("/messages/:id", asyncHandler(handleGetMessageStatus));
router.get("/templates", asyncHandler(handleListTemplates));
router.post("/templates", asyncHandler(handleCreateTemplate));
router.get("/templates/:name/variables", asyncHandler(handleGetTemplateVariables));
router.put("/templates/:id", asyncHandler(handleUpdateTemplate));
router.patch("/templates/:id/deactivate", asyncHandler(handleDeactivateTemplate));
router.patch("/templates/:id/activate", asyncHandler(handleActivateTemplate));
router.patch("/templates/:id/soft-delete", asyncHandler(handleSoftDeleteTemplate));
router.patch("/templates/:id/restore", asyncHandler(handleRestoreTemplate));
router.delete("/templates/:id", asyncHandler(handleDeleteTemplate));

export default router;
