import { Router } from "express";
import { authenticateWorkflow } from "../../middleware/workflowAuth";
import { workflowsController } from "./workflows.controller";

export const workflowsRouter = Router();

// Protect all workflow endpoints with workflow secret
workflowsRouter.use(authenticateWorkflow);

workflowsRouter.post("/reminders/delivery", (req, res, next) =>
  workflowsController.triggerReminderDelivery(req, res, next)
);

workflowsRouter.post("/briefing/trigger", (req, res, next) =>
  workflowsController.triggerDailyBriefing(req, res, next)
);

workflowsRouter.get("/executions", (req, res, next) =>
  workflowsController.getExecutions(req, res, next)
);
