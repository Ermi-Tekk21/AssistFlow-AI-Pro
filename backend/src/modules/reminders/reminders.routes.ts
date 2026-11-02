import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authenticateWorkflow } from "../../middleware/workflowAuth";
import { remindersController } from "./reminders.controller";
import { remindersDeliveryService } from "./remindersDelivery.service";

export const remindersRouter = Router();

// Protected workflow endpoint for n8n / scheduled orchestrator
remindersRouter.post("/process-due", authenticateWorkflow, async (req, res, next) => {
  try {
    const limit = req.body?.limit ? Number(req.body.limit) : 50;
    const result = await remindersDeliveryService.processDueReminders({ limit });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Enforce user authentication on all user-facing reminder routes
remindersRouter.use(authenticate);

remindersRouter.post("/", (req, res, next) => remindersController.create(req, res, next));
remindersRouter.get("/", (req, res, next) => remindersController.list(req, res, next));
remindersRouter.get("/:id", (req, res, next) => remindersController.getById(req, res, next));
remindersRouter.patch("/:id", (req, res, next) => remindersController.update(req, res, next));
remindersRouter.post("/:id/snooze", (req, res, next) => remindersController.snooze(req, res, next));
remindersRouter.post("/:id/cancel", (req, res, next) => remindersController.cancel(req, res, next));
