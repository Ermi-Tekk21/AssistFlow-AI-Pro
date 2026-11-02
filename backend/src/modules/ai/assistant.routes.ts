import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { assistantController } from "./assistant.controller";

const router = Router();

router.use(authenticate);

router.post("/message", assistantController.handleMessage.bind(assistantController));
router.get("/sessions", assistantController.getSession.bind(assistantController));
router.get("/sessions/:sessionId", assistantController.getSession.bind(assistantController));

export const assistantRouter = router;
