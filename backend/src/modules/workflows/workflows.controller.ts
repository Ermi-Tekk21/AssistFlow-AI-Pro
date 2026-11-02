import { Request, Response, NextFunction } from "express";
import { workflowsService } from "./workflows.service";

export class WorkflowsController {
  async triggerReminderDelivery(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const limit = req.body?.limit ? Number(req.body.limit) : 50;
      const triggeredBy = req.body?.triggeredBy ?? "n8n";
      const result = await workflowsService.runReminderDelivery(triggeredBy, limit);

      res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async triggerDailyBriefing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const triggeredBy = req.body?.triggeredBy ?? "n8n";
      const forceUserId = req.body?.forceUserId;
      const result = await workflowsService.runDailyBriefing(triggeredBy, {
        forceUserId,
      });

      res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getExecutions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const workflowName = req.query?.workflowName
        ? String(req.query.workflowName)
        : undefined;
      const limit = req.query?.limit ? Number(req.query.limit) : 50;

      const executions = await workflowsService.getExecutions({
        workflowName,
        limit,
      });

      res.status(200).json({
        data: executions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const workflowsController = new WorkflowsController();
