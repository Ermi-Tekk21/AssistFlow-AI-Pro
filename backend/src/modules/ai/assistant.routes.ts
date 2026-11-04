import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { createRateLimiter } from "../../middleware/rateLimiter";
import { assistantController } from "./assistant.controller";

const router = Router();

router.use(authenticate);

// Limit assistant LLM calls to 100 per minute per user/client to protect quotas
const assistantLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many assistant requests. Please wait a moment before sending more messages.",
});

router.post("/message", assistantLimiter, assistantController.handleMessage.bind(assistantController));
router.get("/sessions", assistantController.getSession.bind(assistantController));
router.get("/sessions/:sessionId", assistantController.getSession.bind(assistantController));

export const assistantRouter = router;
