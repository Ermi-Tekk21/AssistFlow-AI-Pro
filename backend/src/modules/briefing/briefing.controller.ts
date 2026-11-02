import { Request, Response, NextFunction } from "express";
import { briefingService } from "./briefing.service";
import { getAuthenticatedUserId } from "../../middleware/auth";

export class BriefingController {
  async previewBriefing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const compiled = await briefingService.compileBriefingData(userId);
      const html = briefingService.formatBriefingHtml(compiled);

      res.status(200).json({
        data: {
          briefingDate: compiled.localDateStr,
          formattedDate: compiled.formattedDate,
          counts: {
            tasks: compiled.tasks.length,
            reminders: compiled.reminders.length,
            events: compiled.events.length,
          },
          html,
          tasks: compiled.tasks,
          reminders: compiled.reminders,
          events: compiled.events,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async sendBriefing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { force, destinationChatId } = req.body || {};

      const result = await briefingService.sendBriefingForUser(userId, {
        force: Boolean(force),
        destinationChatId,
      });

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async dispatchDue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await briefingService.dispatchScheduledBriefings();
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const briefingController = new BriefingController();
