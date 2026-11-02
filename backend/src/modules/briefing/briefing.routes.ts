import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authenticateWorkflow } from "../../middleware/workflowAuth";
import { briefingController } from "./briefing.controller";

const router = Router();

// User-authenticated endpoints
router.get("/preview", authenticate, briefingController.previewBriefing.bind(briefingController));
router.post("/send", authenticate, briefingController.sendBriefing.bind(briefingController));

// Scheduled / n8n workflow endpoint
router.post("/dispatch-due", authenticateWorkflow, briefingController.dispatchDue.bind(briefingController));

export const briefingRouter = router;
